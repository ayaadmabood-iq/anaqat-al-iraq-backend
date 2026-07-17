import { Equals, IsBoolean, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  bookId: string;

  @IsBoolean()
  @Equals(true, { message: 'يجب الموافقة على اتفاقية الشراء قبل إنشاء الطلب' })
  agreementAccepted: boolean;
}
