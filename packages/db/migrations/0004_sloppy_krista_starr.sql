ALTER TABLE "transmissions" RENAME COLUMN "structured_json" TO "structured_json_enc";
ALTER TABLE "transmissions" ALTER COLUMN "structured_json_enc" TYPE text USING "structured_json_enc"::text;
