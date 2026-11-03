// Brand configuration. One brand per install: to run another brand, copy the
// app and change this file (name, stages, categories, checklists, data repo).
export const BRAND = {
  name: 'Brevista',
  tagline: 'Content pipeline',
  dataRepo: { owner: 'BreVistaEspresso', repo: 'brevista-content-data', branch: 'main' },
  stages: [
    { key: 'ideas', label: 'Ideas', long: 'Ideas / Backlog', desc: 'Premise, audience problem and hook.' },
    { key: 'scripting', label: 'Scripting', long: 'Scripting', desc: 'Outline, draft and review of the script.' },
    { key: 'slidedeck', label: 'Slide deck', long: 'Slide deck ready', desc: 'Teleprompter slides built and tested.' },
    { key: 'filming', label: 'Filming', long: 'Filming', desc: 'A-roll and B-roll at the espresso bar.' },
    { key: 'editing', label: 'Editing', long: 'Editing', desc: 'Assembly, graphics, sound and export.' },
    { key: 'published', label: 'Published', long: 'Published', desc: 'Live on the Brevista YouTube channel.' },
  ],
  categories: [
    'Beginner Fundamentals',
    'Buying Guides',
    'Dialing In & Extraction',
    'Espresso Techniques',
    'Milk Steaming',
    'Troubleshooting',
    'Cleaning & Maintenance',
    'Accessories & Upgrades',
    'Comparisons & Experiments',
  ],
  priorities: [
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ],
  assetTypes: ['Script', 'Slides / teleprompter', 'Thumbnail / hooks', 'Research', 'B-roll', 'Edit project', 'Final video', 'YouTube URL', 'Other'],
  checklists: {
    ideas: ['Audience problem defined', 'Hook drafted', 'Research questions listed'],
    scripting: ['Outline done', 'Script drafted', 'Script reviewed', 'Script final'],
    slidedeck: ['Slides built', 'Teleprompter tested'],
    filming: ['Shot list ready', 'A-roll filmed', 'B-roll filmed', 'Audio checked'],
    editing: ['Rough cut', 'Graphics added', 'Audio mixed', 'Exported'],
    published: ['Uploaded', 'Title and thumbnail set', 'Description and chapters', 'YouTube link saved'],
  },
};

// Default checklist items get stable ids so every device builds identical seed data.
export function defaultStages() {
  const out = {};
  for (const s of BRAND.stages) {
    out[s.key] = { notes: '', checklist: (BRAND.checklists[s.key] || []).map((t, n) => ({ id: `${s.key}-${n}`, t, done: false })) };
  }
  return out;
}
