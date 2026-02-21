-- CreateTable
CREATE TABLE `signal_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `sector` VARCHAR(255) NOT NULL,
    `sectorPattern` VARCHAR(32) NULL,
    `turnover` DOUBLE NULL,
    `triggerTime` VARCHAR(5) NULL,
    `chg` DOUBLE NULL,
    `amount` DOUBLE NULL,
    `intradayNote` VARCHAR(255) NULL,
    `riskNote` VARCHAR(255) NULL,
    `verdict` VARCHAR(8) NULL,
    `plan` VARCHAR(255) NULL,
    `score` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signal_records_date_idx`(`date`),
    INDEX `signal_records_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sector_screenshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `sector` VARCHAR(64) NOT NULL,
    `imageData` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sector_screenshots_date_idx`(`date`),
    UNIQUE INDEX `sector_screenshots_date_sector_key`(`date`, `sector`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
