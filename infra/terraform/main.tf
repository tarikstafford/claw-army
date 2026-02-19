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

module "secrets" {
  source      = "./modules/secrets"
  project_id  = var.project_id
  environment = var.environment
  db_password = module.cloud_sql.user_password

  depends_on = [module.cloud_sql]
}

module "compute" {
  source           = "./modules/compute"
  project_id       = var.project_id
  region           = var.region
  environment      = var.environment
  machine_type     = var.machine_type
  vpc_network_name = module.vpc.network_name
  subnet_name      = module.vpc.subnet_name
  db_host          = module.cloud_sql.private_ip
  db_name          = module.cloud_sql.database_name
  db_user          = module.cloud_sql.user_name
  redis_host       = module.memorystore.host
  redis_port       = module.memorystore.port
  registry_url     = module.artifact_registry.repository_url
  ssh_source_ranges = var.ssh_source_ranges

  depends_on = [
    module.vpc,
    module.cloud_sql,
    module.memorystore,
    module.artifact_registry,
    module.secrets,
  ]
}
