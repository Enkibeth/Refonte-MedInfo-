/**
 * Blog santé — lecture client des articles PUBLIÉS (migration 0022).
 *
 * La RLS ne montre au client (anon compris) que les articles `status = 'published'` ;
 * les brouillons et toutes les écritures passent par /api/admin/blog (service role).
 */
import { getSupabaseClient } from '@/db/supabase';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  cover_image_url: string | null;
  content_md: string;
  published_at: string | null;
}

const COLUMNS = 'id, slug, title, summary, category, cover_image_url, content_md, published_at';

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(COLUMNS)
    .order('published_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as BlogPost;
}
