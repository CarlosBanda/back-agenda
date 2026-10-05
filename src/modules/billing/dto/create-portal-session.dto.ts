import { IsInt, Min } from 'class-validator';

export class CreatePortalSessionDto {
  @IsInt()
  @Min(1)
  businessId: number;
}
