#!/bin/bash
# Cleanup script for orphaned AWS resources
# This script finds Lambda functions, API Gateways, and IAM roles that are not in the database

set -e

# Configuration
AWS_REGION="eu-west-1"
PREFIX="user-app-"

echo "=== Orphaned AWS Resource Cleanup Script ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    echo "Usage: DATABASE_URL='postgresql://...' ./cleanup-orphaned-resources.sh"
    exit 1
fi

# Get list of valid app IDs from database
echo "Fetching valid app IDs from database..."
VALID_APP_IDS=$(psql "$DATABASE_URL" -t -c "SELECT id FROM apps;" 2>/dev/null | tr -d ' ' | grep -v '^$' || echo "")

if [ -z "$VALID_APP_IDS" ]; then
    echo "No apps found in database (or database connection failed)"
    echo "All user-app-* resources are orphaned"
fi

echo "Valid app IDs in database:"
echo "$VALID_APP_IDS" | head -20
echo ""

# Function to check if app_id is valid
is_valid_app() {
    local app_id=$1
    echo "$VALID_APP_IDS" | grep -q "^$app_id$"
}

# Find orphaned Lambda functions
echo "=== Checking Lambda Functions ==="
LAMBDAS=$(aws lambda list-functions --region $AWS_REGION --query "Functions[?starts_with(FunctionName, '${PREFIX}')].FunctionName" --output text)

ORPHANED_LAMBDAS=()
for lambda in $LAMBDAS; do
    # Extract app_id from function name (user-app-{app_id})
    app_id=${lambda#$PREFIX}
    if ! is_valid_app "$app_id"; then
        ORPHANED_LAMBDAS+=("$lambda")
        echo "  ORPHANED: $lambda"
    else
        echo "  OK: $lambda"
    fi
done

echo ""
echo "=== Checking API Gateways ==="
APIS=$(aws apigatewayv2 get-apis --region $AWS_REGION --query "Items[?starts_with(Name, '${PREFIX}')].{Name:Name,Id:ApiId}" --output text)

ORPHANED_APIS=()
while read -r name api_id; do
    if [ -n "$name" ]; then
        # Extract app_id from API name (user-app-api-{app_id})
        app_id=${name#user-app-api-}
        if ! is_valid_app "$app_id"; then
            ORPHANED_APIS+=("$api_id:$name")
            echo "  ORPHANED: $name ($api_id)"
        else
            echo "  OK: $name"
        fi
    fi
done <<< "$APIS"

echo ""
echo "=== Checking IAM Roles ==="
ROLES=$(aws iam list-roles --query "Roles[?starts_with(RoleName, 'user-app-role-')].RoleName" --output text)

ORPHANED_ROLES=()
for role in $ROLES; do
    # Extract app_id from role name (user-app-role-{app_id})
    app_id=${role#user-app-role-}
    if ! is_valid_app "$app_id"; then
        ORPHANED_ROLES+=("$role")
        echo "  ORPHANED: $role"
    else
        echo "  OK: $role"
    fi
done

echo ""
echo "=== Checking CloudWatch Log Groups ==="
LOG_GROUPS=$(aws logs describe-log-groups --region $AWS_REGION --log-group-name-prefix "/aws/lambda/${PREFIX}" --query "logGroups[].logGroupName" --output text)

ORPHANED_LOGS=()
for log_group in $LOG_GROUPS; do
    # Extract app_id from log group name (/aws/lambda/user-app-{app_id})
    app_id=${log_group#/aws/lambda/$PREFIX}
    if ! is_valid_app "$app_id"; then
        ORPHANED_LOGS+=("$log_group")
        echo "  ORPHANED: $log_group"
    else
        echo "  OK: $log_group"
    fi
done

echo ""
echo "=== Summary ==="
echo "Orphaned Lambda functions: ${#ORPHANED_LAMBDAS[@]}"
echo "Orphaned API Gateways: ${#ORPHANED_APIS[@]}"
echo "Orphaned IAM Roles: ${#ORPHANED_ROLES[@]}"
echo "Orphaned Log Groups: ${#ORPHANED_LOGS[@]}"

if [ ${#ORPHANED_LAMBDAS[@]} -eq 0 ] && [ ${#ORPHANED_APIS[@]} -eq 0 ] && [ ${#ORPHANED_ROLES[@]} -eq 0 ] && [ ${#ORPHANED_LOGS[@]} -eq 0 ]; then
    echo ""
    echo "No orphaned resources found!"
    exit 0
fi

echo ""
read -p "Do you want to delete these orphaned resources? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted. No resources deleted."
    exit 0
fi

echo ""
echo "=== Deleting Orphaned Resources ==="

# Delete Lambda functions
for lambda in "${ORPHANED_LAMBDAS[@]}"; do
    echo "Deleting Lambda: $lambda"
    aws lambda delete-function --region $AWS_REGION --function-name "$lambda" || echo "  Failed to delete $lambda"
done

# Delete API Gateways
for api in "${ORPHANED_APIS[@]}"; do
    api_id=${api%%:*}
    api_name=${api#*:}
    echo "Deleting API Gateway: $api_name ($api_id)"
    aws apigatewayv2 delete-api --region $AWS_REGION --api-id "$api_id" || echo "  Failed to delete $api_name"
done

# Delete IAM Roles (must detach policies first)
for role in "${ORPHANED_ROLES[@]}"; do
    echo "Deleting IAM Role: $role"
    # Detach managed policies
    policies=$(aws iam list-attached-role-policies --role-name "$role" --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null || echo "")
    for policy in $policies; do
        echo "  Detaching policy: $policy"
        aws iam detach-role-policy --role-name "$role" --policy-arn "$policy" || true
    done
    # Delete inline policies
    inline_policies=$(aws iam list-role-policies --role-name "$role" --query "PolicyNames[]" --output text 2>/dev/null || echo "")
    for policy in $inline_policies; do
        echo "  Deleting inline policy: $policy"
        aws iam delete-role-policy --role-name "$role" --policy-name "$policy" || true
    done
    # Delete the role
    aws iam delete-role --role-name "$role" || echo "  Failed to delete $role"
done

# Delete CloudWatch Log Groups
for log_group in "${ORPHANED_LOGS[@]}"; do
    echo "Deleting Log Group: $log_group"
    aws logs delete-log-group --region $AWS_REGION --log-group-name "$log_group" || echo "  Failed to delete $log_group"
done

# Clean up orphaned Terraform state files
echo ""
echo "=== Cleaning up Terraform state files ==="
for lambda in "${ORPHANED_LAMBDAS[@]}"; do
    app_id=${lambda#$PREFIX}
    echo "Deleting Terraform state for: $app_id"
    aws s3 rm "s3://cloud-deployer-tf-state/app-plane/$app_id/" --recursive 2>/dev/null || true
done

echo ""
echo "=== Cleanup Complete ==="
