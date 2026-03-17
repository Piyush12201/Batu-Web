const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const { generateLoginCredentials } = require('../utils/jwt');
const XLSX = require('xlsx');

const router = express.Router();

// Get all pending users (for admin dashboard)
router.get('/pending-users', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.mobile_number,
        u.branch,
        u.passport_year AS graduation_year,
        u.current_city AS city,
        u.linkedin_profile AS linkedin_url,
        u.job_type,
        u.sector AS job_sector,
        u.company_name,
        u.designation,
        u.id_proof_url,
        u.status,
        u.created_at
      FROM users u
      WHERE u.status = 'pending_approval'
      ORDER BY u.created_at DESC
    `);

    res.json({
      count: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Get all approved users
router.get('/approved-users', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.mobile_number,
        u.branch,
        u.company_name,
        u.status,
        ua.is_login_enabled,
        ua.last_login_at,
        u.created_at
      FROM users u
      LEFT JOIN user_auth ua ON u.id = ua.user_id
      WHERE u.status = 'approved'
      ORDER BY u.created_at DESC
    `);

    res.json({
      count: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching approved users:', error);
    res.status(500).json({ error: 'Failed to fetch approved users' });
  }
});

// Approve user and enable login
router.post('/approve-user/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { remarks } = req.body;

    // Start transaction
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Update user status
      const userResult = await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, full_name',
        ['approved', userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Enable login (user already set password during registration)
      await client.query(
        `UPDATE user_auth 
         SET is_login_enabled = true, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );

      // Log verification
      await client.query(
        `INSERT INTO verification_logs (user_id, admin_id, action, status, remarks)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, req.adminId, 'approve', 'approved', remarks || 'User approved by admin']
      );

      await client.query('COMMIT');

      res.json({
        message: 'User approved successfully. Login enabled.',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          status: 'approved'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: error.message || 'Failed to approve user' });
  }
});

// Reject user
router.post('/reject-user/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { remarks } = req.body;

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Update user status
      const result = await client.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, full_name',
        ['rejected', userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // Log verification
      await client.query(
        `INSERT INTO verification_logs (user_id, admin_id, action, status, remarks)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, req.adminId, 'reject', 'rejected', remarks || 'User rejected']
      );

      await client.query('COMMIT');

      res.json({
        message: 'User rejected successfully',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          status: 'rejected'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error rejecting user:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Get user details
router.get('/user-details/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT 
        u.*,
        ua.is_login_enabled,
        ua.last_login_at
      FROM users u
      LEFT JOIN user_auth ua ON u.id = ua.user_id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Get verification logs
router.get('/verification-logs/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT 
        vl.*,
        au.name as admin_name
      FROM verification_logs vl
      LEFT JOIN admin_users au ON vl.admin_id = au.id
      WHERE vl.user_id = $1
      ORDER BY vl.created_at DESC
    `, [userId]);

    res.json({
      logs: result.rows
    });
  } catch (error) {
    console.error('Error fetching verification logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get dashboard stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const pendingResult = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE status = $1',
      ['pending_approval']
    );

    const approvedResult = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE status = $1',
      ['approved']
    );

    const rejectedResult = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE status = $1',
      ['rejected']
    );

    const totalResult = await db.query(
      'SELECT COUNT(*) as count FROM users'
    );

    res.json({
      stats: {
        pending: parseInt(pendingResult.rows[0].count),
        approved: parseInt(approvedResult.rows[0].count),
        rejected: parseInt(rejectedResult.rows[0].count),
        total: parseInt(totalResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get filter options for reports
router.get('/report-filters', authenticateAdmin, async (req, res) => {
  try {
    // Get distinct branches
    const branchesResult = await db.query(
      'SELECT DISTINCT branch FROM users WHERE branch IS NOT NULL ORDER BY branch'
    );

    // Get distinct sectors
    const sectorsResult = await db.query(
      'SELECT DISTINCT sector FROM users WHERE sector IS NOT NULL ORDER BY sector'
    );

    // Get distinct job types
    const jobTypesResult = await db.query(
      'SELECT DISTINCT job_type FROM users WHERE job_type IS NOT NULL ORDER BY job_type'
    );

    // Get distinct companies
    const companiesResult = await db.query(
      'SELECT DISTINCT company_name FROM users WHERE company_name IS NOT NULL ORDER BY company_name'
    );

    // Get distinct cities
    const citiesResult = await db.query(
      'SELECT DISTINCT current_city FROM users WHERE current_city IS NOT NULL ORDER BY current_city'
    );

    // Get graduation year range
    const yearsResult = await db.query(
      'SELECT MIN(passport_year) as min_year, MAX(passport_year) as max_year FROM users WHERE passport_year IS NOT NULL'
    );

    res.json({
      branches: branchesResult.rows.map(r => r.branch),
      sectors: sectorsResult.rows.map(r => r.sector),
      jobTypes: jobTypesResult.rows.map(r => r.job_type),
      companies: companiesResult.rows.map(r => r.company_name),
      cities: citiesResult.rows.map(r => r.current_city),
      yearRange: yearsResult.rows[0] || { min_year: null, max_year: null }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

// Generate and download user report
router.post('/generate-report', authenticateAdmin, async (req, res) => {
  try {
    const filters = req.body;
    console.log('📊 Generating report with filters:', filters);

    // Build dynamic query
    let query = `
      SELECT 
        u.full_name,
        u.email,
        u.mobile_number,
        u.branch,
        u.passport_year AS graduation_year,
        u.current_city,
        u.linkedin_profile,
        u.job_type,
        u.sector,
        u.company_name,
        u.designation,
        u.years_of_experience,
        u.skills,
        u.status,
        u.created_at,
        ua.is_login_enabled,
        ua.last_login_at
      FROM users u
      LEFT JOIN user_auth ua ON u.id = ua.user_id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCounter = 1;

    // Add filters dynamically
    if (filters.branch && filters.branch.length > 0) {
      query += ` AND u.branch = ANY($${paramCounter})`;
      queryParams.push(filters.branch);
      paramCounter++;
    }

    if (filters.sector && filters.sector.length > 0) {
      query += ` AND u.sector = ANY($${paramCounter})`;
      queryParams.push(filters.sector);
      paramCounter++;
    }

    if (filters.jobType && filters.jobType.length > 0) {
      query += ` AND u.job_type = ANY($${paramCounter})`;
      queryParams.push(filters.jobType);
      paramCounter++;
    }

    if (filters.company && filters.company.length > 0) {
      query += ` AND u.company_name = ANY($${paramCounter})`;
      queryParams.push(filters.company);
      paramCounter++;
    }

    if (filters.city && filters.city.length > 0) {
      query += ` AND u.current_city = ANY($${paramCounter})`;
      queryParams.push(filters.city);
      paramCounter++;
    }

    if (filters.status && filters.status.length > 0) {
      query += ` AND u.status = ANY($${paramCounter})`;
      queryParams.push(filters.status);
      paramCounter++;
    }

    if (filters.graduationYearFrom) {
      query += ` AND u.passport_year >= $${paramCounter}`;
      queryParams.push(filters.graduationYearFrom);
      paramCounter++;
    }

    if (filters.graduationYearTo) {
      query += ` AND u.passport_year <= $${paramCounter}`;
      queryParams.push(filters.graduationYearTo);
      paramCounter++;
    }

    if (filters.experienceMin !== undefined && filters.experienceMin !== null) {
      query += ` AND u.years_of_experience >= $${paramCounter}`;
      queryParams.push(filters.experienceMin);
      paramCounter++;
    }

    if (filters.experienceMax !== undefined && filters.experienceMax !== null) {
      query += ` AND u.years_of_experience <= $${paramCounter}`;
      queryParams.push(filters.experienceMax);
      paramCounter++;
    }

    query += ' ORDER BY u.created_at DESC';

    console.log('📝 Executing query with params:', queryParams);
    const result = await db.query(query, queryParams);
    
    console.log(`📊 Found ${result.rows.length} users matching filters`);

    // Format data for Excel
    const excelData = result.rows.map(user => ({
      'Full Name': user.full_name,
      'Email': user.email,
      'Mobile': user.mobile_number,
      'Branch': user.branch,
      'Graduation Year': user.graduation_year,
      'City': user.current_city,
      'Company': user.company_name,
      'Designation': user.designation,
      'Job Type': user.job_type,
      'Sector': user.sector,
      'Years of Experience': user.years_of_experience,
      'Skills': Array.isArray(user.skills) ? user.skills.join(', ') : '',
      'LinkedIn': user.linkedin_profile || '',
      'Status': user.status,
      'Login Enabled': user.is_login_enabled ? 'Yes' : 'No',
      'Last Login': user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never',
      'Registered On': new Date(user.created_at).toLocaleString()
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Full Name
      { wch: 30 }, // Email
      { wch: 15 }, // Mobile
      { wch: 25 }, // Branch
      { wch: 15 }, // Graduation Year
      { wch: 15 }, // City
      { wch: 25 }, // Company
      { wch: 20 }, // Designation
      { wch: 15 }, // Job Type
      { wch: 15 }, // Sector
      { wch: 12 }, // Years of Experience
      { wch: 40 }, // Skills
      { wch: 30 }, // LinkedIn
      { wch: 15 }, // Status
      { wch: 12 }, // Login Enabled
      { wch: 20 }, // Last Login
      { wch: 20 }  // Registered On
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumni Report');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `alumni_report_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    console.log(`✅ Sending Excel file: ${filename} (${excelBuffer.length} bytes)`);
    
    // Send the Excel file
    res.send(excelBuffer);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      message: error.message 
    });
  }
});

// Send broadcast message to all approved users
router.post('/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { title, message } = req.body;
    const adminId = req.adminId;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    console.log('📢 Sending broadcast:', { title, message, adminId });

    // Start transaction
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Create broadcast record
      const broadcastResult = await client.query(
        `INSERT INTO broadcasts (admin_id, title, message, sent_at, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, title, message, sent_at`,
        [adminId, title, message]
      );

      const broadcast = broadcastResult.rows[0];
      console.log('✅ Broadcast created:', broadcast.id);

      // Get all approved users
      const usersResult = await client.query(
        `SELECT id FROM users WHERE status = 'approved'`
      );

      const users = usersResult.rows;
      console.log(`📤 Sending to ${users.length} approved users`);


      // Use the system broadcast user as sender_id
      const { rows: systemUserRows } = await client.query(
        "SELECT id FROM users WHERE email = 'broadcast@system.local' LIMIT 1"
      );
      const systemAdminId = systemUserRows[0]?.id;
      if (!systemAdminId) throw new Error('System broadcast user not found');

      for (const user of users) {
        await client.query(
          `INSERT INTO messages (sender_id, receiver_id, content, broadcast_id, sent_at, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [systemAdminId, user.id, `**${title}**\n\n${message}`, broadcast.id]
        );
      }

      console.log(`✅ Created ${users.length} broadcast messages`);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Broadcast sent to ${users.length} users`,
        broadcast_id: broadcast.id,
        recipient_count: users.length
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error sending broadcast:', error);
    res.status(500).json({ 
      error: 'Failed to send broadcast',
      message: error.message 
    });
  }
});

// Get all broadcasts history
router.get('/broadcasts', authenticateAdmin, async (req, res) => {
  try {
    console.log('📋 Fetching broadcast history...');

    const result = await db.query(`
      SELECT 
        b.id,
        b.title,
        b.message,
        b.sent_at,
        b.created_at,
        COUNT(m.id) as recipient_count
      FROM broadcasts b
      LEFT JOIN messages m ON m.broadcast_id = b.id
      GROUP BY b.id, b.title, b.message, b.sent_at, b.created_at
      ORDER BY b.sent_at DESC
      LIMIT 50
    `);

    console.log(`✅ Found ${result.rows.length} broadcasts`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching broadcasts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch broadcasts',
      message: error.message 
    });
  }
});

module.exports = router;
