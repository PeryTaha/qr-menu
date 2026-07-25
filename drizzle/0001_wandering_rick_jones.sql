CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`table_no` integer NOT NULL,
	`allocations` text NOT NULL,
	`total` integer NOT NULL,
	`method` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
