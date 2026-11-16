#!/bin/bash
while true; do
  # فحص إذا كان البوت خدام
  if ! pgrep -f "tsx src/main.ts" > /dev/null; then
    echo "[$(date)] Bot stopped, restarting..."
    cd ~/community-manager && ./start.sh &
  fi
  
  # فحص إذا كان community.ts خدام
  if ! pgrep -f "tsx scripts/community.ts" > /dev/null; then
    echo "[$(date)] Community script stopped, restarting..."
    cd ~/community-manager && npx tsx scripts/community.ts &
  fi
  
  sleep 30
done
