import { decode } from "jsonwebtoken"
import {JwtPayloadSchema} from "./contracts.js";

export class Storage implements Storage {
    private storage: Record<string, string | null> = {};

    get accessToken(): string | null {
        return this.storage["accessToken"];
    }

    set accessToken(value: string | null) {
        this.storage["accessToken"] = value;
    }

    get refreshToken(): string | null {
        return this.storage["refreshToken"];
    }

    set refreshToken(value: string | null) {
        this.storage["refreshToken"] = value;
    }

    public getTokenExpiration(): number | undefined {
        const token = this.accessToken;
        if (token == null) {
            return undefined;
        }

        const payload = JwtPayloadSchema.parse(decode(token));

        return payload.exp;
    }
}
