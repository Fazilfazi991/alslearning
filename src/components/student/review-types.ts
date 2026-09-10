import type { RichText } from "@/lib/rich-text";
import type { QuestionMedia } from "@/lib/question-media";
type Option = { id: string; content: string; content_rich?: RichText };
export type Review = {
  status: string;
  results_visible: boolean;
  score: number | null;
  total_marks: number;
  answers: {
    question_id: string;
    prompt: string;
    prompt_rich?: RichText;
    stem_media?: QuestionMedia[];
    options: Option[];
    selected_option_ids: string[];
    correct_option_ids: string[];
    marks_awarded: number;
    explanation: string | null;
    explanation_rich?: RichText;
    solution_media?: QuestionMedia[];
    stem_image_path: string | null;
    explanation_image_path: string | null;
  }[];
};
