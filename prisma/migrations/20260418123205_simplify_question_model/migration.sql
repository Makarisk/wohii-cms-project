/*
  Warnings:

  - You are about to drop the column `content` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the `_keywordtoquestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `keywords` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `answer` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `questions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `_keywordtoquestion` DROP FOREIGN KEY `_KeywordToQuestion_A_fkey`;

-- DropForeignKey
ALTER TABLE `_keywordtoquestion` DROP FOREIGN KEY `_KeywordToQuestion_B_fkey`;

-- AlterTable
ALTER TABLE `questions` DROP COLUMN `content`,
    DROP COLUMN `date`,
    DROP COLUMN `title`,
    ADD COLUMN `answer` TEXT NOT NULL,
    ADD COLUMN `question` TEXT NOT NULL;

-- DropTable
DROP TABLE `_keywordtoquestion`;

-- DropTable
DROP TABLE `keywords`;
