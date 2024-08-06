'use server';

import {z} from 'zod';
import {sql} from '@vercel/postgres';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {signIn} from '@/auth';
import { AuthError } from 'next-auth';

export type State = {
    errors?: {
        customerId?: string[],
        amount?: string[],
        status?: string[],
    };
    message?: string | null;
};

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({invalid_type_error: 'Please select a customer'}), // invalid_type_error is a custom error message
    // coerce makes string to change into number while validating type
    amount: z.coerce.number().gt(0, {message: 'Amount must be greater than $0'}), // message is a custom error message
    status: z.enum(['pending', 'paid'], {invalid_type_error: 'Please select a status'}), // message is a custom error message
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true});
const UpdateInvoice = FormSchema.omit({id: true, date: true});

export async function createInvoice(prevState: State, formData: FormData){
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = (amount * 100);
    const date = new Date().toISOString().split('T')[0];

    try{
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date) 
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    }
    catch(error){
        return {message: 'Database error: Unable to create invoice'};
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State,formData: FormData){
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    const {customerId, amount, status} = validatedFields.data;

    const amountInCents = (amount * 100);

    try{
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    }
    catch(error){
        return {message: 'Database error: Unable to update invoice'};
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string){

    try{
        await sql`
            DELETE FROM invoices
            WHERE id = ${id}
        `;
        revalidatePath('/dashboard/invoices');
    }
    catch(error){
        return {message: 'Database error: Unable to delete invoice'};
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
      // log in successful
      alert('Logged in successfully');
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }