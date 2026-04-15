import { prisma } from '../../../config/prisma.js';

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      description: true,
      _count: { select: { listings: true } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      description: true,
    },
  });
}
