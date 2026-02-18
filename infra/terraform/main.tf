provider "google" {
  project = var.project_id
  region  = var.region
}

module "vpc" {
  source      = "./modules/vpc"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
}

module "cloud_sql" {
  source           = "./modules/cloud-sql"
  project_id       = var.project_id
  region           = var.region
  environment      = var.environment
  db_tier          = var.db_tier
  vpc_network_id   = module.vpc.network_id
  vpc_network_name = module.vpc.network_name

  depends_on = [module.vpc]
}

module "memorystore" {
  source               = "./modules/memorystore"
  project_id           = var.project_id
  region               = var.region
  environment          = var.environment
  redis_memory_size_gb = var.redis_memory_size_gb
  vpc_network_name     = module.vpc.network_name

  depends_on = [module.vpc]
}

module "pubsub" {
  source      = "./modules/pubsub"
  project_id  = var.project_id
  environment = var.environment
}

module "artifact_registry" {
  source      = "./modules/artifact-registry"
  project_id  = var.project_id
  region      = var.region
  environment = var.environment
}
