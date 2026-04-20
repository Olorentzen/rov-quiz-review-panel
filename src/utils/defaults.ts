import type { Question, Stage5Pack } from '../types/pack';

export function createDefaultPack(): Stage5Pack {
  return {
    manual_id: 'new-pack',
    manual_name: 'New Pack',
    oem_brand: '',
    vehicle_family: '',
    display_title: 'New Quiz Pack',
    source_type: 'manual',
    learning_categories: [],
    rank_profiles: [],
    questions: [],
  };
}

export function createDefaultQuestion(id: string): Question {
  return {
    question_id: id,
    stem: '',
    options: ['', '', '', ''],
    correct_answer_index: 0,
    explanation: '',
    difficulty: 'easy',
    min_rank: 'pilot_1',
    subsystem_category: '',
    subsystem_label: '',
    learning_categories: [],
    tags: [],
    confidence: 0.5,
    source_quote: '',
    isApproved: false,
    reviewStatus: 'unreviewed',
  };
}

export function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
