import { StandardCheckoutClient, Env } from "pg-sdk-node";
import dotenv from "dotenv";

dotenv.config();

const clientVersion = parseInt(process.env.CLIENT_VERSION!);

const clientId = process.env.CLIENT_ID!;
const clientSecret = process.env.CLIENT_SECRET!;

const env = Env.SANDBOX; 

export const phonePayClient = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env
);
