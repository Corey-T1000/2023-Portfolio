import { defineCollection, z } from 'astro:content';

export const collections = {
	work: defineCollection({
		schema: z.object({
      featured: z.boolean(),
			featuredRank: z.number().optional(),
			title: z.string(),
			description: z.string(),
			date: z.coerce.date(),
			tags: z.array (z.string()),
      thumb: z.string(),
			img: z.array(
				z.object({
					url: z.string(),
					alt: z.string().optional(),
					cols: z.number().optional(),
				})
			),
		}),
	}),
};
