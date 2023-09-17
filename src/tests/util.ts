import { AccessTokenData, JwtPayload, JwtPayloadSchema } from "./contracts.js";
import * as jwt from "jsonwebtoken";
import {JWT_LIFETIME, JWT_SECRET} from "../constants.js";
import * as util from "node:util";

const verify = util.promisify(jwt.verify) as (token: string, secretOrPublicKey: string) => Promise<jwt.JwtPayload>;

export function createAccessToken(payload: AccessTokenData, expiresIn = JWT_LIFETIME): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn
    })
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
	const payload = await verify(token, JWT_SECRET);
	return JwtPayloadSchema.parse(payload);
}

function getAccessTokenFromHeader(header: string): string {
	return header.split(" ")[1];
}


export async function verifyAuthentication(headers: Headers) {
	const token = headers.get("authorization");

	if (token == null) {
		throw new Error("Unauthorized");
	}

	return verifyAccessToken(getAccessTokenFromHeader(token));
}
