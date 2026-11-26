import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from "../../constants/validation.constants";

/** One entry in a Blog's FAQ list. The list itself has no maximum. */
export class FaqItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(FAQ_QUESTION_MAX_LENGTH)
  question: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(FAQ_ANSWER_MAX_LENGTH)
  answer: string;
}
