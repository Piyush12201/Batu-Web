#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 System Health Check"
echo "======================"
echo ""

# Check if services are running
check_service() {
  local service=$1
  local port=$2
  
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓${NC} $service is running on port $port"
    return 0
  else
    echo -e "${RED}✗${NC} $service is NOT running on port $port"
    return 1
  fi
}

# Check backend
check_service "Backend API" 5000

# Check PostgreSQL
check_service "PostgreSQL" 5432

# Check Redis
check_service "Redis" 6379

# Check Nginx (if running)
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
  check_service "Nginx" 80
fi

echo ""
echo "📊 API Health Check"
echo "==================="

# Check API health endpoint
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health)

if [ "$HEALTH_CHECK" == "200" ]; then
  echo -e "${GREEN}✓${NC} API health check passed"
  
  # Display health details
  echo ""
  echo "Health Details:"
  curl -s http://localhost:5000/api/health | jq '.'
else
  echo -e "${RED}✗${NC} API health check failed (Status: $HEALTH_CHECK)"
fi

echo ""
echo "📈 Performance Metrics"
echo "====================="

# Check metrics endpoint (requires admin token)
# Uncomment and add admin token if needed:
# METRICS=$(curl -s -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:5000/api/metrics)
# echo "$METRICS" | jq '.'

echo ""
echo "💾 Database Status"
echo "=================="

# Check database connection
if command -v psql &> /dev/null; then
  DB_STATUS=$(psql -h localhost -U postgres -d alumni_db -c "SELECT version();" 2>&1)
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Database connection successful"
  else
    echo -e "${RED}✗${NC} Database connection failed"
  fi
else
  echo -e "${YELLOW}⚠${NC} psql command not found, skipping database check"
fi

echo ""
echo "📦 Redis Status"
echo "==============="

# Check Redis connection
if command -v redis-cli &> /dev/null; then
  REDIS_PING=$(redis-cli ping 2>&1)
  if [ "$REDIS_PING" == "PONG" ]; then
    echo -e "${GREEN}✓${NC} Redis connection successful"
    
    # Get Redis info
    echo ""
    echo "Redis Info:"
    redis-cli info stats | grep -E "total_connections_received|total_commands_processed|used_memory_human"
  else
    echo -e "${RED}✗${NC} Redis connection failed"
  fi
else
  echo -e "${YELLOW}⚠${NC} redis-cli command not found, skipping Redis check"
fi

echo ""
echo "🔌 Socket.IO Connections"
echo "========================"

# Check active Socket.IO connections (from logs or metrics)
echo "Check metrics endpoint for active connections"

echo ""
echo "💽 Disk Usage"
echo "============="

# Check disk usage
df -h / | tail -n 1 | awk '{print "Used: " $3 " / " $2 " (" $5 ")"}'

echo ""
echo "🧠 Memory Usage"
echo "==============="

# Check memory usage
free -h | grep Mem | awk '{print "Used: " $3 " / " $2}'

echo ""
echo "📁 Log Files"
echo "============"

# Check recent errors in logs
if [ -f "backend/logs/error.log" ]; then
  ERROR_COUNT=$(tail -n 100 backend/logs/error.log | grep -i error | wc -l)
  echo "Recent errors in last 100 lines: $ERROR_COUNT"
  
  if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Recent errors found. Check backend/logs/error.log"
  fi
else
  echo "No error log file found"
fi

echo ""
echo "✅ Health check complete!"
