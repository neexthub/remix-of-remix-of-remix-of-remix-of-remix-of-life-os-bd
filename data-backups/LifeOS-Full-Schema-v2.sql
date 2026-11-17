-- MariaDB dump 10.19-11.4.12-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: lifeos_install_schema
-- ------------------------------------------------------
-- Server version	11.4.12-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `activation_point_transactions`
--

DROP TABLE IF EXISTS `activation_point_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_point_transactions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `amount` int(11) NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'credit',
  `note` varchar(255) DEFAULT NULL,
  `admin_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `activation_requests`
--

DROP TABLE IF EXISTS `activation_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 1000.00,
  `method` varchar(50) NOT NULL,
  `sender_number` varchar(50) DEFAULT NULL,
  `trx_id` varchar(100) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5136 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `admin_messages`
--

DROP TABLE IF EXISTS `admin_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receiver_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `admin_roles`
--

DROP TABLE IF EXISTS `admin_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_roles` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(80) NOT NULL,
  `color` varchar(20) DEFAULT '#050f3d',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(80) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `last_active` timestamp NULL DEFAULT NULL,
  `two_fa_enabled` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_suggestions`
--

DROP TABLE IF EXISTS `ai_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_suggestions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(60) NOT NULL,
  `prompt_text` varchar(255) NOT NULL,
  `icon_class` varchar(50) DEFAULT 'fa-lightbulb',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `api_logs`
--

DROP TABLE IF EXISTS `api_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `partner_id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `request_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`request_payload`)),
  `response_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`response_payload`)),
  `status_code` int(11) NOT NULL,
  `latency_ms` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_user_bonus_summary`
--

DROP TABLE IF EXISTS `audit_user_bonus_summary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_user_bonus_summary` (
  `user_id` int(10) unsigned NOT NULL,
  `matching_bonus` decimal(14,2) DEFAULT 0.00,
  `generation_bonus` decimal(14,2) DEFAULT 0.00,
  `refer_bonus` decimal(14,2) DEFAULT 0.00,
  `cashback_bonus` decimal(14,2) DEFAULT 0.00,
  `admin_bonus` decimal(14,2) DEFAULT 0.00,
  `total_bonus` decimal(14,2) DEFAULT 0.00,
  `binary_pairs` int(11) DEFAULT 0,
  `enrollment_pairs` int(11) DEFAULT 0,
  `best_tree_pairs` int(11) DEFAULT 0,
  `best_tree_type` varchar(30) DEFAULT 'Binary',
  `exp_daily_cap_matching` decimal(14,2) DEFAULT 0.00,
  `matching_diff` decimal(14,2) DEFAULT 0.00,
  `exp_generation` decimal(14,2) DEFAULT 0.00,
  `exp_refer` decimal(14,2) DEFAULT 0.00,
  `exp_cashback` decimal(14,2) DEFAULT 0.00,
  `total_expected_daily_cap` decimal(14,2) DEFAULT 0.00,
  `extra_daily_cap` decimal(14,2) DEFAULT 0.00,
  `daily_matching_excess` decimal(14,2) DEFAULT 0.00,
  `daily_over_days_cnt` int(11) DEFAULT 0,
  `p2p_sent` decimal(14,2) DEFAULT 0.00,
  `p2p_received` decimal(14,2) DEFAULT 0.00,
  `tx_count` int(11) DEFAULT 0,
  PRIMARY KEY (`user_id`),
  KEY `idx_tot` (`total_bonus`),
  KEY `idx_extra_daily` (`extra_daily_cap`),
  KEY `idx_match_ex` (`daily_matching_excess`),
  KEY `idx_match_diff` (`matching_diff`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `b2b_api_keys`
--

DROP TABLE IF EXISTS `b2b_api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `b2b_api_keys` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `partner_id` varchar(50) NOT NULL,
  `partner_name` varchar(120) NOT NULL,
  `api_key` varchar(100) NOT NULL,
  `secret_key` varchar(100) NOT NULL,
  `environment` enum('sandbox','production') DEFAULT 'sandbox',
  `status` enum('active','revoked') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_used` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bank_requests`
--

DROP TABLE IF EXISTS `bank_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` enum('account_open','loan','card','deposit') DEFAULT 'account_open',
  `bank_name` varchar(80) DEFAULT NULL,
  `amount` decimal(14,2) DEFAULT NULL,
  `status` enum('pending','processing','approved','rejected') DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `banners`
--

DROP TABLE IF EXISTS `banners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `banners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `badge_text` varchar(100) DEFAULT NULL,
  `title` varchar(100) NOT NULL,
  `subtitle` varchar(100) DEFAULT NULL,
  `button_text` varchar(50) DEFAULT 'Explore Now',
  `button_link` varchar(255) DEFAULT '#',
  `banner_type` enum('gradient','invite') DEFAULT 'gradient',
  `icon_class` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `commission_settlements`
--

DROP TABLE IF EXISTS `commission_settlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_settlements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `partner_id` varchar(50) NOT NULL,
  `transaction_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `commission_amount` decimal(10,2) NOT NULL,
  `commission_type` enum('Partner Commission','Service Fee','Referral Commission') DEFAULT 'Partner Commission',
  `status` enum('pending','settled','failed') DEFAULT 'pending',
  `settlement_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consent_history`
--

DROP TABLE IF EXISTS `consent_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `consent_history` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `partner_name` varchar(255) NOT NULL,
  `data_shared` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data_shared`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `education_enrollments`
--

DROP TABLE IF EXISTS `education_enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `education_enrollments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `course_name` varchar(120) DEFAULT NULL,
  `institution` varchar(100) DEFAULT NULL,
  `type` varchar(40) DEFAULT 'online',
  `status` enum('pending','active','completed','cancelled') DEFAULT 'pending',
  `fee` decimal(10,2) DEFAULT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `external_partners`
--

DROP TABLE IF EXISTS `external_partners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `external_partners` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `partner_id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `category` varchar(50) NOT NULL,
  `api_endpoint` varchar(255) NOT NULL,
  `auth_type` enum('OAuth2','JWT','API Key') DEFAULT 'API Key',
  `api_key` varchar(255) DEFAULT NULL,
  `secret_key` varchar(255) DEFAULT NULL,
  `webhook_url` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive','testing') DEFAULT 'testing',
  `priority` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `flushed_matching_bonuses`
--

DROP TABLE IF EXISTS `flushed_matching_bonuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `flushed_matching_bonuses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `health_appointments`
--

DROP TABLE IF EXISTS `health_appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `health_appointments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `doctor_name` varchar(80) DEFAULT NULL,
  `hospital` varchar(100) DEFAULT NULL,
  `appointment_date` datetime DEFAULT NULL,
  `type` varchar(40) DEFAULT 'consultation',
  `status` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `fee` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `income_types`
--

DROP TABLE IF EXISTS `income_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `income_types` (
  `id` tinyint(3) unsigned NOT NULL,
  `title_en` varchar(80) NOT NULL,
  `title_bn` varchar(80) DEFAULT NULL,
  `description_bn` text DEFAULT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `insurance_policies`
--

DROP TABLE IF EXISTS `insurance_policies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `insurance_policies` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `policy_no` varchar(40) DEFAULT NULL,
  `provider` varchar(80) DEFAULT NULL,
  `type` varchar(40) DEFAULT 'life',
  `premium` decimal(10,2) DEFAULT NULL,
  `sum_assured` decimal(14,2) DEFAULT NULL,
  `status` enum('pending','active','lapsed','cancelled') DEFAULT 'pending',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `live_chat`
--

DROP TABLE IF EXISTS `live_chat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `live_chat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `sender_type` enum('user','admin') NOT NULL,
  `message` text DEFAULT NULL,
  `attachment_url` varchar(255) DEFAULT NULL,
  `attachment_type` varchar(50) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_activations`
--

DROP TABLE IF EXISTS `lo_activations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_activations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activation_code` varchar(40) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `payment_ref` varchar(120) NOT NULL,
  `payment_status` enum('PENDING','SUCCESS','FAILED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `fee` decimal(14,3) NOT NULL DEFAULT 1000.000,
  `bv` int(11) NOT NULL DEFAULT 1000,
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activation_code` (`activation_code`),
  UNIQUE KEY `payment_ref` (`payment_ref`),
  KEY `user_id` (`user_id`),
  KEY `lo_activations_status` (`payment_status`,`processed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_admin_audit`
--

DROP TABLE IF EXISTS `lo_admin_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_admin_audit` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` bigint(20) unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `ip` varchar(45) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lo_admin_audit_user` (`user_id`),
  KEY `lo_admin_audit_admin` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_allocations`
--

DROP TABLE IF EXISTS `lo_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_allocations` (
  `activation_id` bigint(20) unsigned NOT NULL,
  `category` varchar(30) NOT NULL,
  `amount` decimal(14,6) NOT NULL,
  PRIMARY KEY (`activation_id`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_daily_caps`
--

DROP TABLE IF EXISTS `lo_daily_caps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_daily_caps` (
  `user_id` int(10) unsigned NOT NULL,
  `cap_date` date NOT NULL,
  `paid` decimal(14,6) NOT NULL DEFAULT 0.000000,
  PRIMARY KEY (`user_id`,`cap_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_deposits`
--

DROP TABLE IF EXISTS `lo_deposits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_deposits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `deposit_code` varchar(60) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `kind` enum('ADMIN_ADD','ACTIVATE_ID','E_SWAP') NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `target_user_id` int(10) unsigned DEFAULT NULL,
  `activation_id` bigint(20) unsigned DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `deposit_code` (`deposit_code`),
  KEY `user_id` (`user_id`,`created_at`),
  KEY `target_user_id` (`target_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_enroll_legs`
--

DROP TABLE IF EXISTS `lo_enroll_legs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_enroll_legs` (
  `upline_id` int(10) unsigned NOT NULL,
  `leg_user_id` int(10) unsigned NOT NULL,
  `carry` decimal(14,3) NOT NULL DEFAULT 0.000,
  `consumed` decimal(14,3) NOT NULL DEFAULT 0.000,
  PRIMARY KEY (`upline_id`,`leg_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_financial_lock`
--

DROP TABLE IF EXISTS `lo_financial_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_financial_lock` (
  `id` tinyint(4) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_ledger`
--

DROP TABLE IF EXISTS `lo_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `payout_code` varchar(60) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `ledger_type` enum('CASHBACK','REFERRAL','MATCHING','GENERATION','RANK','ADJUSTMENT','WITHDRAW') NOT NULL,
  `amount` decimal(14,6) NOT NULL,
  `activation_id` bigint(20) unsigned DEFAULT NULL,
  `sale_id` bigint(20) unsigned DEFAULT NULL,
  `ref_id` bigint(20) unsigned DEFAULT NULL,
  `level` tinyint(3) unsigned DEFAULT NULL,
  `status` enum('PENDING','PAID','REJECTED','REVERSED','ADJUSTED') NOT NULL DEFAULT 'PAID',
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `payout_code` (`payout_code`),
  KEY `user_id` (`user_id`,`ledger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_master_audit`
--

DROP TABLE IF EXISTS `lo_master_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_master_audit` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(60) NOT NULL,
  `target` varchar(255) DEFAULT NULL,
  `ip` varchar(45) NOT NULL,
  `ok` tinyint(1) NOT NULL,
  `detail` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_matching_bills`
--

DROP TABLE IF EXISTS `lo_matching_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_matching_bills` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` int(10) unsigned NOT NULL,
  `bill_type` enum('ENROLLMENT','BINARY') NOT NULL,
  `amount` decimal(14,6) NOT NULL,
  `status` enum('CALCULATED','ELIGIBLE','SELECTED') NOT NULL DEFAULT 'CALCULATED',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_matching_decisions`
--

DROP TABLE IF EXISTS `lo_matching_decisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_matching_decisions` (
  `decision_key` varchar(100) NOT NULL,
  `event_code` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`decision_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_matching_events`
--

DROP TABLE IF EXISTS `lo_matching_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_matching_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(50) NOT NULL,
  `sale_id` bigint(20) unsigned NOT NULL,
  `activation_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` int(10) unsigned NOT NULL,
  `sponsor_id` int(10) unsigned DEFAULT NULL,
  `placement_parent_id` int(10) unsigned DEFAULT NULL,
  `event_number` tinyint(3) unsigned DEFAULT NULL,
  `enrollment_bill` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `binary_bill` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `selected_bill` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `selected_type` enum('ENROLLMENT','BINARY') DEFAULT NULL,
  `calculated_payout` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `actual_payout` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `reserve_before` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `reserve_after` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `daily_before` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `daily_after` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `payout_status` enum('PENDING','PAID','REJECTED','REVERSED','ADJUSTED','FLUSHED') NOT NULL DEFAULT 'PENDING',
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_code` (`event_code`),
  UNIQUE KEY `uq_sale_event_beneficiary` (`sale_id`,`event_number`,`beneficiary_id`),
  KEY `beneficiary_id` (`beneficiary_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_merchant_api_keys`
--

DROP TABLE IF EXISTS `lo_merchant_api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_merchant_api_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `key_prefix` varchar(20) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `status` enum('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_used_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key_hash` (`key_hash`),
  KEY `status` (`status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_merchant_cashback_debits`
--

DROP TABLE IF EXISTS `lo_merchant_cashback_debits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_merchant_cashback_debits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `debit_code` varchar(60) NOT NULL,
  `merchant_key_id` bigint(20) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `request_id` varchar(80) NOT NULL,
  `request_hash` char(64) NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `balance_after` decimal(14,3) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `debit_code` (`debit_code`),
  UNIQUE KEY `uq_merchant_request` (`merchant_key_id`,`request_id`),
  KEY `user_id` (`user_id`,`created_at`),
  KEY `merchant_key_id` (`merchant_key_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_migrations`
--

DROP TABLE IF EXISTS `lo_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_migrations` (
  `name` varchar(190) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_notices`
--

DROP TABLE IF EXISTS `lo_notices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_notices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('NOTICE','SCROLL') NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `content` text NOT NULL,
  `show_from` date DEFAULT NULL,
  `show_to` date DEFAULT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `updated_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `kind` (`kind`,`is_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_placement_lock`
--

DROP TABLE IF EXISTS `lo_placement_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_placement_lock` (
  `id` tinyint(4) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_pool_movements`
--

DROP TABLE IF EXISTS `lo_pool_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_pool_movements` (
  `movement_code` varchar(80) NOT NULL,
  `activation_id` bigint(20) unsigned NOT NULL,
  `pool` varchar(30) NOT NULL,
  `amount` decimal(14,6) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`movement_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_pools`
--

DROP TABLE IF EXISTS `lo_pools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_pools` (
  `pool` varchar(30) NOT NULL,
  `balance` decimal(16,6) NOT NULL DEFAULT 0.000000,
  PRIMARY KEY (`pool`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_ranks`
--

DROP TABLE IF EXISTS `lo_ranks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_ranks` (
  `id` tinyint(3) unsigned NOT NULL,
  `name` varchar(60) NOT NULL,
  `required_matchings` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_recharges`
--

DROP TABLE IF EXISTS `lo_recharges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_recharges` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recharge_code` varchar(60) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `operator` varchar(10) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `status` enum('PENDING','PAID','REJECTED') NOT NULL DEFAULT 'PENDING',
  `admin_note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recharge_code` (`recharge_code`),
  KEY `user_id` (`user_id`,`status`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_sales`
--

DROP TABLE IF EXISTS `lo_sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_sales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sale_code` varchar(40) NOT NULL,
  `activation_id` bigint(20) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `matching_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `matching_reserve` decimal(14,6) NOT NULL DEFAULT 300.000000,
  `matching_paid` decimal(14,6) NOT NULL DEFAULT 0.000000,
  `generation_paid` decimal(14,3) NOT NULL DEFAULT 0.000,
  `rank_pool` decimal(14,3) NOT NULL DEFAULT 200.000,
  `status` enum('OPEN','EXHAUSTED','REVERSED') NOT NULL DEFAULT 'OPEN',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sale_code` (`sale_code`),
  UNIQUE KEY `activation_id` (`activation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_settings`
--

DROP TABLE IF EXISTS `lo_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_settings` (
  `k` varchar(60) NOT NULL,
  `v` varchar(255) NOT NULL,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_statements`
--

DROP TABLE IF EXISTS `lo_statements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_statements` (
  `statement_code` varchar(60) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `statement_date` date NOT NULL,
  `matching_paid` decimal(14,6) NOT NULL,
  `event_count` int(10) unsigned NOT NULL,
  `closed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`statement_code`),
  UNIQUE KEY `uq_user_day` (`user_id`,`statement_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_transfers`
--

DROP TABLE IF EXISTS `lo_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_transfers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transfer_code` varchar(60) NOT NULL,
  `from_user_id` int(10) unsigned NOT NULL,
  `to_user_id` int(10) unsigned NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `transfer_code` (`transfer_code`),
  KEY `from_user_id` (`from_user_id`,`created_at`),
  KEY `to_user_id` (`to_user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_tree`
--

DROP TABLE IF EXISTS `lo_tree`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_tree` (
  `user_id` int(10) unsigned NOT NULL,
  `sponsor_id` int(10) unsigned DEFAULT NULL,
  `placement_parent_id` int(10) unsigned DEFAULT NULL,
  `placement_side` enum('L','R') DEFAULT NULL,
  `left_child_id` int(10) unsigned DEFAULT NULL,
  `right_child_id` int(10) unsigned DEFAULT NULL,
  `left_carry` decimal(14,3) NOT NULL DEFAULT 0.000,
  `right_carry` decimal(14,3) NOT NULL DEFAULT 0.000,
  `left_consumed` decimal(14,3) NOT NULL DEFAULT 0.000,
  `right_consumed` decimal(14,3) NOT NULL DEFAULT 0.000,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `lifetime_matchings` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`),
  KEY `sponsor_id` (`sponsor_id`),
  KEY `placement_parent_id` (`placement_parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_user_ranks`
--

DROP TABLE IF EXISTS `lo_user_ranks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_user_ranks` (
  `user_id` int(10) unsigned NOT NULL,
  `rank_id` tinyint(3) unsigned NOT NULL,
  `achieved_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`rank_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_volume_pairs`
--

DROP TABLE IF EXISTS `lo_volume_pairs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_volume_pairs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `decision_key` varchar(100) NOT NULL,
  `sale_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` int(10) unsigned NOT NULL,
  `tree_type` enum('BINARY','ENROLLMENT') NOT NULL,
  `first_volume_id` bigint(20) unsigned NOT NULL,
  `second_volume_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_first_volume` (`first_volume_id`),
  UNIQUE KEY `uq_second_volume` (`second_volume_id`),
  KEY `decision_key` (`decision_key`),
  KEY `sale_id` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_volumes`
--

DROP TABLE IF EXISTS `lo_volumes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_volumes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` int(10) unsigned NOT NULL,
  `tree_type` enum('BINARY','ENROLLMENT') NOT NULL,
  `leg_id` int(10) unsigned NOT NULL,
  `status` enum('CARRY','CONSUMED','INVALID') NOT NULL DEFAULT 'CARRY',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_source_leg` (`sale_id`,`beneficiary_id`,`tree_type`),
  KEY `beneficiary_id` (`beneficiary_id`,`tree_type`,`status`,`leg_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_wallet_swaps`
--

DROP TABLE IF EXISTS `lo_wallet_swaps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_wallet_swaps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `swap_code` varchar(60) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `charge` decimal(14,3) NOT NULL,
  `credited` decimal(14,3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `swap_code` (`swap_code`),
  KEY `user_id` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lo_withdrawals`
--

DROP TABLE IF EXISTS `lo_withdrawals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_withdrawals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `method` varchar(40) NOT NULL,
  `account_number` varchar(80) NOT NULL,
  `amount` decimal(14,3) NOT NULL,
  `charge` decimal(14,3) NOT NULL DEFAULT 0.000,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `admin_note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  `member_note` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loan_refund_logs`
--

DROP TABLE IF EXISTS `loan_refund_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_refund_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `refund_amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'frozen',
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_batch` (`batch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=975 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loan_reset_backup`
--

DROP TABLE IF EXISTS `loan_reset_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_reset_backup` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `old_loan_recovery_active` tinyint(4) NOT NULL DEFAULT 0,
  `old_loan_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `old_loan_paid` decimal(14,2) NOT NULL DEFAULT 0.00,
  `old_wallet_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'reset',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_batch` (`batch_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_adjustments`
--

DROP TABLE IF EXISTS `matching_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_adjustments` (
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `old_flat_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `new_level_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `already_paid` decimal(14,2) NOT NULL DEFAULT 0.00,
  `old_pending` decimal(14,2) NOT NULL DEFAULT 0.00,
  `new_pending` decimal(14,2) NOT NULL DEFAULT 0.00,
  `excess_deducted` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'adjusted',
  `adjusted_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_carry_forward`
--

DROP TABLE IF EXISTS `matching_carry_forward`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_carry_forward` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL COMMENT 'αª»αª╛αª░ carry forward BV',
  `leg` enum('left','right') NOT NULL,
  `bv_carried` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Carried forward BV amount',
  `bv_used` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αª¬αª░αª¼αª░αºìαªñαºÇ matching-αªÅ αª¼αºìαª»αª¼αª╣αª╛αª░ αª╣αª»αª╝αºçαª¢αºç',
  `bv_remaining` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αªÅαªûαª¿αºï unused',
  `source_event_id` bigint(20) unsigned DEFAULT NULL COMMENT 'αªòαºïαª¿ event-αªÅαª░ αª¬αª░ carry αª╣αª»αª╝αºçαª¢αºç',
  `status` enum('active','used','expired') NOT NULL DEFAULT 'active',
  `carry_date` date NOT NULL,
  `used_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Carry forward BV after pair matching. Strong/Weak excess BV stored here.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_daily_caps`
--

DROP TABLE IF EXISTS `matching_daily_caps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_daily_caps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `cap_date` date NOT NULL COMMENT 'αªòαºïαª¿ αªªαª┐αª¿αºçαª░ cap',
  `cap_limit` decimal(14,2) NOT NULL DEFAULT 5000.00 COMMENT 'Maximum for this day',
  `used_amount` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αªåαª£αªòαºç αªòαªñαªƒαºüαªòαºü αª¼αºìαª»αª¼αª╣αª╛αª░ αª╣αª»αª╝αºçαª¢αºç',
  `remaining` decimal(14,2) NOT NULL DEFAULT 5000.00 COMMENT 'αªòαªñαªƒαºüαªòαºü αª¼αª╛αªòαª┐ αªåαª¢αºç',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1883 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily matching income cap per member. Resets at midnight.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_events`
--

DROP TABLE IF EXISTS `matching_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `upline_user_id` int(10) unsigned NOT NULL COMMENT 'αª»αºç upline commission αª¬αª╛αª¼αºçαª¿',
  `upline_level` tinyint(3) unsigned NOT NULL DEFAULT 1 COMMENT 'Upline level (1-5)',
  `reservoir_id` bigint(20) unsigned NOT NULL COMMENT 'αªòαºïαª¿ reservoir αªÑαºçαªòαºç payout αª╣αª¼αºç',
  `activation_user_id` int(10) unsigned NOT NULL COMMENT 'αª»αª╛αª░ activation trigger αªòαª░αºçαª¢αºç',
  `strong_leg_user_id` int(10) unsigned DEFAULT NULL COMMENT 'Strong leg network member',
  `weak_leg_user_id` int(10) unsigned DEFAULT NULL COMMENT 'Weak leg network member',
  `strong_leg_bv` decimal(14,2) NOT NULL COMMENT 'Strong leg total BV',
  `weak_leg_bv` decimal(14,2) NOT NULL COMMENT 'Weak leg total BV',
  `matched_bv` decimal(14,2) NOT NULL COMMENT 'MIN(strong_leg_bv, weak_leg_bv)',
  `matching_rate_pct` decimal(5,2) NOT NULL DEFAULT 10.00 COMMENT 'Applied rate (%)',
  `calculated_commission` decimal(14,2) NOT NULL COMMENT 'matched_bv ├ù rate/100',
  `available_reserve` decimal(14,2) NOT NULL COMMENT 'Reserve available at event time',
  `daily_cap_remaining` decimal(14,2) NOT NULL COMMENT 'Daily cap remaining at event time',
  `final_payout` decimal(14,2) NOT NULL COMMENT 'MIN(calculated, reserve, cap)',
  `status` enum('pending','approved','paid','rejected','skipped') NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(255) DEFAULT NULL,
  `event_date` date NOT NULL COMMENT 'Matching date',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5594 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Every pair formation event. Final payout = MIN(calculated, reserve, daily_cap).';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_forgiven_excess`
--

DROP TABLE IF EXISTS `matching_forgiven_excess`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_forgiven_excess` (
  `user_id` int(10) unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_payouts`
--

DROP TABLE IF EXISTS `matching_payouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_payouts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `reservoir_id` bigint(20) unsigned DEFAULT NULL,
  `recipient_id` bigint(20) unsigned NOT NULL,
  `amount_approved` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amount_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reserve_before` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reserve_after` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reserve_status` varchar(20) DEFAULT NULL,
  `wallet_txn_id` bigint(20) unsigned DEFAULT NULL,
  `note` text DEFAULT NULL,
  `paid_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matching_reservoirs`
--

DROP TABLE IF EXISTS `matching_reservoirs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `matching_reservoirs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activation_user_id` int(10) unsigned NOT NULL COMMENT 'αª»αºç user activate αªòαª░αºçαª¢αºç',
  `package_amount` decimal(14,2) NOT NULL DEFAULT 1000.00 COMMENT 'Package price (αº│1,000)',
  `reserve_pct` decimal(5,2) NOT NULL DEFAULT 30.00 COMMENT 'Reserve percentage (30%)',
  `reserve_total` decimal(14,2) NOT NULL COMMENT 'Total reserve = package ├ù reserve_pct/100',
  `reserve_used` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αªòαªñαªƒαºüαªòαºü αª¼αºìαª»αª¼αª╣αª╛αª░ αª╣αª»αª╝αºçαª¢αºç',
  `reserve_remaining` decimal(14,2) NOT NULL COMMENT 'αªòαªñαªƒαºüαªòαºü αª¼αª╛αªòαª┐ αªåαª¢αºç',
  `status` enum('open','exhausted','cancelled') NOT NULL DEFAULT 'open',
  `activated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `exhausted_at` timestamp NULL DEFAULT NULL COMMENT 'αªòαªûαª¿ reserve αª╢αºçαª╖ αª╣αª»αª╝αºçαª¢αºç',
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7463 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-activation matching reserve pool. Total paid can NEVER exceed reserve_total.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mfs_providers`
--

DROP TABLE IF EXISTS `mfs_providers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `mfs_providers` (
  `id` smallint(5) unsigned NOT NULL,
  `name` varchar(40) NOT NULL,
  `slug` varchar(40) NOT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `network_bv_ledger`
--

DROP TABLE IF EXISTS `network_bv_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `network_bv_ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL COMMENT 'αª»αª╛αª░ BV αª▓αºçαª£αª╛αª░',
  `leg` enum('left','right') NOT NULL COMMENT 'Left = Strong/Weak αª╣αª¼αºç comparison-αªÅ',
  `bv_added` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αªÅαªç entry-αªñαºç αª»αºïαªù αª╣αªôαª»αª╝αª╛ BV',
  `bv_cumulative` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'αªÅαªç leg-αªÅ total cumulative BV',
  `carry_forward_bv` decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Carry forward BV (matched pair-αªÅαª░ αª¬αª░ αª¼αª╛αªòαª┐)',
  `source_user_id` int(10) unsigned DEFAULT NULL COMMENT 'αªòαºïαª¿ user-αªÅαª░ activation αªÑαºçαªòαºç αªÅαªç BV',
  `reservoir_id` bigint(20) unsigned DEFAULT NULL COMMENT 'αªòαºïαª¿ reservoir-αªÅαª░ αª╕αª╛αªÑαºç linked',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Strong/Weak leg BV accumulation ledger for each network member.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications_queue`
--

DROP TABLE IF EXISTS `notifications_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications_queue` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `channel` enum('Push','SMS','Email','In-App') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('pending','sent','failed') DEFAULT 'pending',
  `retry_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `sent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `offers`
--

DROP TABLE IF EXISTS `offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `offers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL,
  `discount_badge` varchar(20) NOT NULL,
  `icon_class` varchar(50) DEFAULT 'fa-tags text-gold',
  `bg_class` varchar(50) DEFAULT 'bg-dark',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_reset_requests`
--

DROP TABLE IF EXISTS `password_reset_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `life_id` varchar(20) NOT NULL,
  `email` varchar(120) NOT NULL,
  `status` enum('pending','resolved') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_gateways`
--

DROP TABLE IF EXISTS `payment_gateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_gateways` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(30) NOT NULL,
  `name` varchar(80) NOT NULL,
  `type` enum('MFS','Bank','Aggregator','Card') NOT NULL,
  `fee_pct` decimal(5,2) DEFAULT 0.00,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `priority` tinyint(3) unsigned DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `point_activated_ids`
--

DROP TABLE IF EXISTS `point_activated_ids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `point_activated_ids` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `operator_user_id` int(10) unsigned NOT NULL,
  `target_user_id` int(10) unsigned NOT NULL,
  `target_life_id` varchar(50) NOT NULL,
  `points_used` int(10) unsigned NOT NULL DEFAULT 1000,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_operator` (`operator_user_id`),
  KEY `idx_target` (`target_user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=154 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quick_access_items`
--

DROP TABLE IF EXISTS `quick_access_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quick_access_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) NOT NULL,
  `icon_class` varchar(50) NOT NULL,
  `color_class` varchar(30) NOT NULL,
  `link_url` varchar(255) DEFAULT '#',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rank_reward_funds`
--

DROP TABLE IF EXISTS `rank_reward_funds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rank_reward_funds` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activation_user_id` int(10) unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 200.00,
  `status` enum('allocated','disbursed') NOT NULL DEFAULT 'allocated',
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rrf_user` (`activation_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ranks`
--

DROP TABLE IF EXISTS `ranks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ranks` (
  `id` tinyint(3) unsigned NOT NULL,
  `name_en` varchar(60) NOT NULL,
  `name_bn` varchar(80) DEFAULT NULL,
  `criteria_bn` text DEFAULT NULL,
  `reward_en` text DEFAULT NULL,
  `color_hex` varchar(10) DEFAULT '#050f3d',
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `required_directs` int(11) NOT NULL DEFAULT 0,
  `required_pairs` int(11) NOT NULL DEFAULT 0,
  `reward_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `description` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_categories`
--

DROP TABLE IF EXISTS `service_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_items`
--

DROP TABLE IF EXISTS `service_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `service_id` smallint(5) unsigned NOT NULL,
  `label_en` varchar(120) NOT NULL,
  `label_bn` varchar(120) DEFAULT NULL,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` smallint(5) unsigned NOT NULL,
  `slug` varchar(60) NOT NULL,
  `title_en` varchar(80) NOT NULL,
  `title_bn` varchar(80) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `icon` varchar(60) DEFAULT NULL,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `category_slug` varchar(50) DEFAULT 'finance'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shopping_orders`
--

DROP TABLE IF EXISTS `shopping_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shopping_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `merchant_name` varchar(100) DEFAULT NULL,
  `items_count` int(10) unsigned DEFAULT 1,
  `total` decimal(10,2) DEFAULT NULL,
  `status` enum('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` mediumtext DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `travel_bookings`
--

DROP TABLE IF EXISTS `travel_bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `travel_bookings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` enum('flight','bus','train','hotel','launch') DEFAULT 'bus',
  `from_location` varchar(80) DEFAULT NULL,
  `to_location` varchar(80) DEFAULT NULL,
  `travel_date` date DEFAULT NULL,
  `passengers` tinyint(3) unsigned DEFAULT 1,
  `fare` decimal(10,2) DEFAULT NULL,
  `status` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usage_history`
--

DROP TABLE IF EXISTS `usage_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `usage_history` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `service_name` varchar(255) NOT NULL,
  `action` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_enrollment_watermarks`
--

DROP TABLE IF EXISTS `user_enrollment_watermarks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_enrollment_watermarks` (
  `user_id` int(11) NOT NULL,
  `consumed_pairs` int(11) NOT NULL DEFAULT 0,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_notifications`
--

DROP TABLE IF EXISTS `user_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'general',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_life_id` (`life_id`),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB AUTO_INCREMENT=5250 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `name_en` varchar(120) DEFAULT NULL,
  `name_bn` varchar(120) DEFAULT NULL,
  `father_name` varchar(120) DEFAULT NULL,
  `mother_name` varchar(120) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `marital_status` varchar(30) DEFAULT NULL,
  `occupation` varchar(80) DEFAULT NULL,
  `nationality` varchar(60) DEFAULT NULL,
  `blood_group` varchar(5) DEFAULT NULL,
  `religion` varchar(40) DEFAULT NULL,
  `photo_base64` mediumtext DEFAULT NULL,
  `nid_number` varchar(30) DEFAULT NULL,
  `nid_front_base64` mediumtext DEFAULT NULL,
  `nid_back_base64` mediumtext DEFAULT NULL,
  `selfie_base64` mediumtext DEFAULT NULL,
  `kyc_status` enum('not-started','pending','verified') NOT NULL DEFAULT 'not-started',
  `address_current` text DEFAULT NULL,
  `address_permanent` text DEFAULT NULL,
  `phone_alt` varchar(20) DEFAULT NULL,
  `emergency_contact` varchar(120) DEFAULT NULL,
  `emergency_phone` varchar(20) DEFAULT NULL,
  `bank_name` varchar(80) DEFAULT NULL,
  `bank_account` varchar(40) DEFAULT NULL,
  `mfs_provider` varchar(30) DEFAULT NULL,
  `mfs_number` varchar(20) DEFAULT NULL,
  `nominee_name` varchar(80) DEFAULT NULL,
  `nominee_relation` varchar(40) DEFAULT NULL,
  `spouse_name` varchar(80) DEFAULT NULL,
  `children_count` tinyint(3) unsigned DEFAULT 0,
  `education_level` varchar(60) DEFAULT NULL,
  `workplace` varchar(120) DEFAULT NULL,
  `designation` varchar(80) DEFAULT NULL,
  `business_name` varchar(120) DEFAULT NULL,
  `membership_type` enum('free','founder') NOT NULL DEFAULT 'free',
  `completion_pct` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fin_monthly_tx` varchar(60) DEFAULT NULL,
  `fin_annual_tx` varchar(60) DEFAULT NULL,
  `fin_source_funds` varchar(120) DEFAULT NULL,
  `fin_source_wealth` varchar(120) DEFAULT NULL,
  `fin_income_range` varchar(60) DEFAULT NULL,
  `fin_acc_purpose` varchar(120) DEFAULT NULL,
  `tax_tin` varchar(60) DEFAULT NULL,
  `tax_residency` varchar(80) DEFAULT NULL,
  `comp_is_pep` tinyint(1) DEFAULT 0,
  `comp_aml_consent` tinyint(1) DEFAULT 0,
  `comp_signature` mediumtext DEFAULT NULL,
  `district` varchar(60) DEFAULT NULL,
  `post_code` varchar(12) DEFAULT NULL,
  `ward_no` varchar(30) DEFAULT NULL,
  `union_name` varchar(100) DEFAULT NULL,
  `upazila` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13767 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_rewards`
--

DROP TABLE IF EXISTS `user_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_rewards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `points` int(11) DEFAULT 0,
  `cashback_balance` decimal(15,2) DEFAULT 0.00,
  `pending_bills` int(11) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_wallets`
--

DROP TABLE IF EXISTS `user_wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_wallets` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `frozen_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `pending_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `service_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cashback_balance` decimal(14,2) DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'BDT',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=111660 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `life_id` varchar(20) NOT NULL,
  `membership_no` varchar(20) NOT NULL,
  `referral_code` varchar(20) NOT NULL,
  `referred_by` varchar(20) DEFAULT NULL,
  `placement_id` int(10) unsigned DEFAULT NULL,
  `position` enum('left','right') DEFAULT NULL,
  `left_count` int(11) DEFAULT 0,
  `right_count` int(11) DEFAULT 0,
  `total_pairs` int(11) DEFAULT 0,
  `consumed_rank_pairs` int(11) DEFAULT 0,
  `phone` varchar(20) NOT NULL,
  `email` varchar(120) DEFAULT NULL,
  `pin_hash` varchar(255) NOT NULL,
  `transaction_password_hash` varchar(255) DEFAULT NULL,
  `rank_id` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `status` enum('active','suspended','pending') NOT NULL DEFAULT 'pending',
  `accepted_terms` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `points` int(10) unsigned DEFAULT 0,
  `activation_points` int(10) unsigned NOT NULL DEFAULT 0,
  `loan_recovery_active` tinyint(1) DEFAULT 0,
  `loan_amount` decimal(12,2) DEFAULT 0.00,
  `loan_paid` decimal(12,2) DEFAULT 0.00,
  `username` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lo_users_username` (`username`),
  KEY `lo_users_life_id` (`life_id`),
  KEY `lo_users_phone` (`phone`),
  KEY `lo_users_referral_code` (`referral_code`),
  KEY `lo_users_referred_by` (`referred_by`)
) ENGINE=InnoDB AUTO_INCREMENT=23977 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallet_quick_actions`
--

DROP TABLE IF EXISTS `wallet_quick_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_quick_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) NOT NULL,
  `icon_class` varchar(50) NOT NULL,
  `color_class` varchar(30) DEFAULT '',
  `link_url` varchar(255) DEFAULT '#',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallet_transactions`
--

DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_transactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` enum('credit','debit','pending') NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `ref_id` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `wallet_id` int(10) unsigned DEFAULT NULL,
  `category` varchar(50) DEFAULT 'general',
  `status` varchar(50) NOT NULL DEFAULT 'completed',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category` (`category`),
  KEY `idx_type` (`type`),
  KEY `idx_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=244297 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `withdraw_requests`
--

DROP TABLE IF EXISTS `withdraw_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdraw_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `life_id` varchar(50) NOT NULL,
  `method` varchar(50) NOT NULL,
  `account_number` varchar(100) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `charge` decimal(14,2) NOT NULL DEFAULT 0.00,
  `net_amount` decimal(14,2) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `admin_note` text DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_life_id` (`life_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-11-09 12:19:48
-- MariaDB dump 10.19-11.4.12-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: lifeos_install_schema
-- ------------------------------------------------------
-- Server version	11.4.12-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Dumping data for table `lo_migrations`
--

LOCK TABLES `lo_migrations` WRITE;
/*!40000 ALTER TABLE `lo_migrations` DISABLE KEYS */;
INSERT INTO `lo_migrations` VALUES
('001_legacy_schema.sql','2026-11-09 12:13:58'),
('002_lifeos_engine.sql','2026-11-09 12:13:58'),
('003_financial_safeguards.sql','2026-11-09 12:13:58'),
('004_admin_panel.sql','2026-11-09 12:13:58'),
('005_team_join.sql','2026-11-09 12:13:58'),
('006_member_panel_fields.sql','2026-11-09 12:13:58'),
('007_member_transactions.sql','2026-11-09 12:13:58'),
('008_deposit_wallet.sql','2026-11-09 12:13:58'),
('009_member_lookup_indexes.sql','2026-11-09 12:13:58'),
('010_admin_audit.sql','2026-11-09 12:13:58'),
('011_wallet_swap.sql','2026-11-09 12:13:58'),
('012_merchant_cashback.sql','2026-11-09 12:13:58');
/*!40000 ALTER TABLE `lo_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `lo_settings`
--

LOCK TABLES `lo_settings` WRITE;
/*!40000 ALTER TABLE `lo_settings` DISABLE KEYS */;
INSERT INTO `lo_settings` VALUES
('daily_matching_cap','5000'),
('financial_release_approved','0'),
('login_status','1'),
('matching_paused','0'),
('merchant_api_status','0'),
('profile_edit_status','1'),
('recharge_max','5000'),
('recharge_min','10'),
('recharge_status','0'),
('signup_status','1'),
('site_email',''),
('site_name','Life OS'),
('site_slogan',''),
('site_url',''),
('transfer_max','25000'),
('transfer_min','10'),
('transfer_status','0'),
('withdraw_charge_pct','10'),
('withdraw_max','25000'),
('withdraw_min','500'),
('withdrawal_status','1');
/*!40000 ALTER TABLE `lo_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `lo_ranks`
--

LOCK TABLES `lo_ranks` WRITE;
/*!40000 ALTER TABLE `lo_ranks` DISABLE KEYS */;
INSERT INTO `lo_ranks` VALUES
(1,'Member',0),
(2,'Silver Executive',100),
(3,'Gold Executive',300),
(4,'Gold/Executive',1000),
(5,'Platinum Executive',5000),
(6,'Diamond Executive',25000),
(7,'Crown Executive',125000),
(8,'Ambassador',500000),
(9,'Global Ambassador',1500000);
/*!40000 ALTER TABLE `lo_ranks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `lo_pools`
--

LOCK TABLES `lo_pools` WRITE;
/*!40000 ALTER TABLE `lo_pools` DISABLE KEYS */;
INSERT INTO `lo_pools` VALUES
('GENERATION_UNPAID',0.000000),
('MATCHING_BUFFER',0.000000),
('RANK',0.000000),
('REFERRAL_UNPAID',0.000000);
/*!40000 ALTER TABLE `lo_pools` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `lo_financial_lock`
--

LOCK TABLES `lo_financial_lock` WRITE;
/*!40000 ALTER TABLE `lo_financial_lock` DISABLE KEYS */;
INSERT INTO `lo_financial_lock` VALUES
(1);
/*!40000 ALTER TABLE `lo_financial_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `lo_placement_lock`
--

LOCK TABLES `lo_placement_lock` WRITE;
/*!40000 ALTER TABLE `lo_placement_lock` DISABLE KEYS */;
INSERT INTO `lo_placement_lock` VALUES
(1);
/*!40000 ALTER TABLE `lo_placement_lock` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-11-09 12:19:48
