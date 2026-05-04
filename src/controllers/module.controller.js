const { getSupabase } = require('../config/supabase');
const messages = require('../constants/messages');
const { createSignedStreamToken } = require('../utils/cloudflareStream');
const { success, failure } = require('../utils/response');

async function listModules(req, res) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('modules')
    .select(
      'id, order_index, title, description, duration_seconds, thumbnail_url'
    )
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return success(res, data || [], '', 200);
}

async function getModuleVideoToken(req, res) {
  const supabase = getSupabase();
  const { id } = req.params;

  const { data: mod, error } = await supabase
    .from('modules')
    .select('id, video_id, is_published')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!mod || !mod.is_published) {
    return failure(res, messages.MODULE_NOT_FOUND, 404);
  }
  if (!mod.video_id) {
    return failure(res, messages.VIDEO_TOKEN_FAILED, 502);
  }

  try {
    const token = await createSignedStreamToken(mod.video_id);
    return success(res, { token }, '', 200);
  } catch (e) {
    console.error('Cloudflare Stream token error:', e.message);
    return failure(res, messages.VIDEO_TOKEN_FAILED, 502);
  }
}

module.exports = {
  listModules,
  getModuleVideoToken,
};
