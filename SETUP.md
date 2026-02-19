Deployment Playbook

  Prerequisites (one-time)

  # 1. Install tools
  brew install terraform google-cloud-sdk

  # 2. Create a GCP project and authenticate
  gcloud auth login
  gcloud auth application-default login
  gcloud projects create your-project-id --name="Claw Army"
  gcloud config set project your-project-id

  # 3. Enable required APIs (takes ~2 minutes)
  gcloud services enable \
    compute.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    pubsub.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com

  Step 1 — Configure Terraform

  cd infra/terraform
  cp terraform.tfvars.example terraform.tfvars
  # Edit terraform.tfvars — set project_id at minimum

  Step 2 — Provision infrastructure

  terraform init
  terraform plan   # review what will be created
  terraform apply  # takes ~10 minutes (Cloud SQL is the slow one)artifact_registry_url = "us-central1-docker.pkg.dev/claw-army/claw-bots-dev"
db_connection_name = "claw-army:us-central1:claw-postgres-dev"
db_database_name = "clawdb"
db_password = <sensitive>
db_private_ip = "10.101.0.3"
db_user_name = "clawapp"
pubsub_subscription_names = {
  "billing_events" = "billing-events-sub-dev"
  "bot_lifecycle" = "bot-lifecycle-sub-dev"
  "execution_lifecycle" = "execution-lifecycle-sub-dev"
  "guardrail_events" = "guardrail-events-sub-dev"
  "task_lifecycle" = "task-lifecycle-sub-dev"
}
pubsub_topic_names = {
  "billing_events" = "billing-events-dev"
  "bot_lifecycle" = "bot-lifecycle-dev"
  "dead_letter" = "dead-letter-dev"
  "execution_lifecycle" = "execution-lifecycle-dev"
  "guardrail_events" = "guardrail-events-dev"
  "task_lifecycle" = "task-lifecycle-dev"
}
redis_host = "10.98.137.115"
redis_port = 6379
secret_names = {
  "anthropic_key" = "claw-anthropic-api-key"
  "db_password" = "claw-db-password-dev"
  "openai_api_key" = "claw-openai-api-key"
}
vm_external_ip = "34.136.15.56"
vm_ssh_command = "gcloud compute ssh claw-app-dev --zone=us-central1-a --project=claw-army"

  At the end, note these outputs:
  artifact_registry_url = "us-central1-docker.pkg.dev/your-project/claw-bots-dev"
  vm_external_ip        = "34.x.x.x"
  vm_ssh_command        = "gcloud compute ssh claw-app-dev --zone=..."

  Step 3 — Add API keys to Secret Manager

  # Add whichever providers you're using:
  echo -n "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" | gcloud secrets versions add claw-openai-api-key --data-file=-
  echo -n "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" | gcloud secrets versions add claw-anthropic-api-key --data-file=-

  Step 4 — Build and push Docker images

  # Authenticate Docker with Artifact Registry (run once)
  gcloud auth configure-docker us-central1-docker.pkg.dev

  REGISTRY="us-central1-docker.pkg.dev/claw-army/claw-bots-dev"

  # Build from repo root (Dockerfiles reference workspace files)
  docker build -f services/execution-service/Dockerfile -t $REGISTRY/execution-service:latest .
  docker build -f services/bot-worker/Dockerfile        -t $REGISTRY/bot-worker:latest        .
  docker build -f services/tool-gateway/Dockerfile      -t $REGISTRY/tool-gateway:latest      .

  docker push $REGISTRY/execution-service:latest
  docker push $REGISTRY/bot-worker:latest
  docker push $REGISTRY/tool-gateway:latest

  Step 5 — Start services on the VM

  # The startup script runs automatically on first boot.
  # If images weren't pushed in time, SSH in and run the update helper:
  gcloud compute ssh claw-app-dev --zone=us-central1-a --project=your-project
  # On the VM:
  claw-update   # pulls latest images and restarts services

  Step 6 — Build and deploy the UI

  cd services/ui
  VITE_API_URL=http://34.x.x.x:3001 pnpm run build

  # Deploy to Netlify (or drag services/ui/build/ to netlify.com/drop)
  npx netlify deploy --dir=build --prod

  ---
  Estimated monthly cost (dev): ~$50–70
  - Cloud SQL db-f1-micro: ~$7
  - Memorystore 1GB: ~$16
  - GCE e2-standard-2: ~$25
  - Artifact Registry + Pub/Sub: ~$5


  ⏺ Yes, completely. The UI is just static files that call VITE_API_URL — it doesn't matter where it's hosted as long as that env var points at your GCE VM.    
                                                                                                                                                              
  One thing to check — CORS. The execution-service needs to accept requests from whatever domain the UI is on:                                                
                                                       
⏺ Searched for 2 patterns (ctrl+o to expand)                                                                                                                  
                                                       
⏺ CORS is locked to localhost:5173 by default — it needs to know the UI's domain. The easiest fix for an MVP: set it to * so any origin works, then tighten it
   once you have a permanent URL.
                                                                                                                                                              
  Update the docker-compose on the VM by adding one line to /etc/claw/.env after you deploy:
                                                                                                                                                              
  # SSH into the VM                                                                                                                                           
  gcloud compute ssh claw-app-dev --zone=us-central1-a --project=claw-army                                                                                    

  # Add your UI domain (or * for now)
  echo "CORS_ORIGIN=*" >> /etc/claw/.env

  # Restart execution-service to pick up the change
  claw-update

  Once you have a permanent UI URL (e.g. https://claw-army.netlify.app), replace * with the actual domain:

  sed -i 's|CORS_ORIGIN=.*|CORS_ORIGIN=https://claw-army-ui.vercel.app|' /etc/claw/.env
  claw-update

34.136.15.56
VITE_API_URL = http://34.136.15.56:3001