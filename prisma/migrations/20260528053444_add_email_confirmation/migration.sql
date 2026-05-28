ALTER TABLE `users`
  ADD COLUMN `emailConfirmed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `emailConfirmationToken` VARCHAR(191) NULL,
  ADD COLUMN `emailConfirmationExpiry` DATETIME(3) NULL;

CREATE UNIQUE INDEX `users_emailConfirmationToken_key` ON `users`(`emailConfirmationToken`);