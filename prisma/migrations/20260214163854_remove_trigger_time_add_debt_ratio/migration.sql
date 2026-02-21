-- AlterTable
ALTER TABLE `signal_records` DROP COLUMN `triggerTime`,
    ADD COLUMN `debtRatio` DOUBLE NULL;
