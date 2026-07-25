CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`table_no` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`items` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`total` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
