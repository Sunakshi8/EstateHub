import type { HydratedDocument } from "mongoose";
import type { IUser, IUserMethods } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<IUser, IUserMethods>;
      /** Propagated into Kafka events so a request can be traced end-to-end. */
      correlationId?: string;
    }
  }
}

export {};
