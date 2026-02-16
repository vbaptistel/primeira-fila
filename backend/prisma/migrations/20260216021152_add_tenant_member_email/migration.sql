/*
  Warnings:

  - Added the required column `email` to the `tenant_members` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tenant_members" ADD COLUMN     "email" VARCHAR(180) NOT NULL;
