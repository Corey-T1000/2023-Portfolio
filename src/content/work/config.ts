import { defineCollection, z } from 'astro:content';

export const collections = {
	work: defineCollection({
		schema: z.object({
			title: z.string(),
			description: z.string(),
			publishDate: z.coerce.date(),
			tags: z.array(z.string()),
			img: z.array(
				z.object({
					url: z.string(),
					alt: z.string().optional(),
					cols: z.number().optional()
				})
			),
		}),
	}),
};
