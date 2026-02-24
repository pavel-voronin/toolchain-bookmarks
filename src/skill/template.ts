import skillMd from '../../assets/bookmarks/SKILL.md' with { type: 'text' };

const EMBEDDED_SKILL_TEMPLATE: Array<{ relativePath: string; content: string }> = [
  { relativePath: 'SKILL.md', content: skillMd }
];

export function loadSkillTemplateFiles(): Array<{ relativePath: string; content: string }> {
  return EMBEDDED_SKILL_TEMPLATE;
}
