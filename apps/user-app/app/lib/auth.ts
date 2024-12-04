import db from "@repo/db/client";
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt";

export const authOptions = {
    providers: [
      CredentialsProvider({
          name: 'Credentials',
          credentials: {
            phone: { label: "Phone number", type: "text", placeholder: "1231231231", required: true },
            password: { label: "Password", type: "password", required: true }
          },
          async authorize(credentials: any) {

            const hashedPassword = await bcrypt.hash(credentials.password, 10);
            const existingUser = await db.user.findFirst({
                where: {
                    number: credentials.phone
                }
            });

            if (existingUser) {
                const passwordValidation = await bcrypt.compare(credentials.password, existingUser.password);
                if (passwordValidation) {
                    return {
                        id: existingUser.id.toString(),
                        name: existingUser.name,
                        email: existingUser.number
                    }
                }
                return null;
            }

            try {
                const user = await db.user.create({
                    data: {
                        number: credentials.phone,
                        password: hashedPassword
                    }
                });
                
                try {
                    const newUser = await db.user.findFirst({
                        where: {
                            number: credentials.phone
                        }
                    });
                    if (newUser?.id) {
                        await db.balance.create({
                            data: {
                                userId: newUser.id,
                                amount: 0,
                                locked: 0
                            }
                        });
                    } else {
                        throw new Error("New user created but ID not found");
                    }
                } catch (balanceError) {
                    console.error("Error creating balance entry:", balanceError);
                    await db.user.delete({
                        where: {
                            id: user.id
                        }
                    });
                    throw new Error("User registration failed due to balance creation error");
                }
                
                return {
                    id: user.id.toString(),
                    name: user.name,
                    email: user.number
                }
            } catch(e) {
                console.error("Error creating user or balance: ", e);
                return null;
            }
          },
        })
    ],
    secret: process.env.JWT_SECRET || "secret",
    callbacks: {

        async session({ token, session }: any) {
            session.user.id = token.sub

            return session
        }
    }
  }
