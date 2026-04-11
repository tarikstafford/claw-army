import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSkills, createSkill, updateSkill, deleteSkill, approveSkill, getPendingSkills, type CreateSkillInput } from '$lib/api.js';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');
  if (!companyId) throw error(400, 'No company context');

  const skillsRes = await Promise.allSettled([
    fetch(`/api/akasa/companies/${companyId}/skills`),
    fetch(`/api/akasa/companies/${companyId}/skills/pending`),
  ]);

  const skills = skillsRes[0].status === 'fulfilled' && skillsRes[0].value.ok
    ? await skillsRes[0].value.json()
    : [];

  return {
    skills,
    companyId,
    createSkill: async (cid: string, input: CreateSkillInput) => createSkill(cid, input),
    updateSkill: async (id: string, input: Partial<CreateSkillInput>) => updateSkill(id, input),
    deleteSkill: async (id: string) => deleteSkill(id),
    approveSkill: async (id: string) => approveSkill(id),
  };
};
