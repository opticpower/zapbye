import { NextApiRequest, NextApiResponse } from 'next';

export default async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
      const {
            method,
      } = req

      if(method != "POST") {
            res.statusCode = 405
            res.json( {error: "Method Not Allowed"})
      }

      var lemlistBody: string = req.body;
      console.log(lemlistBody);
      res.statusCode = 200
      res.json({response:"200 OK"})
}

interface Lemlist {
      type: string,
      campaignName: string,
      leadEmail: string,
      sendUserName: string,
      sequenceStep: string,
}

interface SalesforceTask {
      dueDate: string, //TODO: find better type
      status: string,
      subjet: string,
      assignedTo: string, //TODO: confirm actual ID
      priority: string,
}