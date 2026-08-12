ALTER TABLE "transmissions" ALTER COLUMN "structured_json_enc" TYPE jsonb USING to_jsonb("structured_json_enc");
ALTER TABLE "transmissions" RENAME COLUMN "structured_json_enc" TO "structured_json";
