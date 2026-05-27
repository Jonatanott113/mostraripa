CREATE TABLE `ip_accesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ip` varchar(45) NOT NULL,
	`user_agent` text,
	`referer` varchar(2048),
	`country` varchar(2),
	`city` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_accesses_id` PRIMARY KEY(`id`)
);
