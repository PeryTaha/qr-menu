CREATE TABLE `table_sessions` (
	`table_no` integer PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`access_code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `table_sessions_token_unique` ON `table_sessions` (`token`);