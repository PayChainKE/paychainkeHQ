#!/bin/bash

# PayChainKE Production & Local API Verifier

echo "Checking Local Backend (port 5000)..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health > local_status.txt
LOCAL_CODE=$(cat local_status.txt)
if [ "$LOCAL_CODE" == "200" ]; then
    echo "✅ Local Backend is UP and Healthy"
else
    echo "❌ Local Backend is DOWN or returning $LOCAL_CODE"
fi

echo "-----------------------------------"
echo "Checking Production Backend (paychain.co.ke)..."
curl -s -o /dev/null -w "%{http_code}" https://www.paychain.co.ke/api/health > prod_status.txt
PROD_CODE=$(cat prod_status.txt)
if [ "$PROD_CODE" == "200" ]; then
    echo "✅ Production Backend is UP and Healthy"
elif [ "$PROD_CODE" == "404" ]; then
    echo "❌ Production API was NOT FOUND (404). This usually means the deployment hasn't picked up the new vercel.json configuration yet."
else
    echo "❌ Production Backend is returning $PROD_CODE"
fi

rm local_status.txt prod_status.txt
