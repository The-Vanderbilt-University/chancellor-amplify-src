import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";


const downloadOp = withApiAuthRequired(
    async (req: NextApiRequest, res: NextApiResponse) => {

        let apiUrl = process.env.CONVERT_API_URL || "";

        // Accessing itemData parameters from the request
        const reqData = req.body;
        const payload = reqData.data;
        const op = reqData.op;

        apiUrl = apiUrl + op;

        try {
            const { accessToken } = await getAccessToken(req, res);

            const response = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({data:payload}),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Convert op:${op} failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling download: ", error);
            res.status(500).json({ error: `Could not perform download op:${op}` });
        }
    }
);

export default downloadOp;