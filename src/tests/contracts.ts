import {z} from "zod";

export const UserSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
})

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
    email: z.string().email(),
});

export const LoginResponseSchema = z.object({
    token: z.string().min(1),
    refreshToken: z.string().min(1),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export const RefreshTokenResponseSchema = z.object({
    token: z.string().min(1),
});

export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;


export const JwtPayloadSchema = z.object({
    userId: z.number(),
    exp: z.number(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const AccessTokenDataSchema = JwtPayloadSchema.omit({
    exp: true,
});

export type AccessTokenData = z.infer<typeof AccessTokenDataSchema>;
