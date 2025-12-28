import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event) => {

  const phoneNumber = event?.Details?.ContactData?.CustomerEndpoint?.Address;
  console.log(event?.Details?.ContactData?.CustomerEndpoint?.Address);

  const customerParams = {
    TableName: "kn_customers",
    Key: {
      phoneNumber: { S: phoneNumber }
    }
  };

  try {
    
    const customerResult = await client.send(
      new GetItemCommand(customerParams)
    );
    
    if (!customerResult.Item) {
    return {
      userType: "NEW"
    };
  }
  
  const name = customerResult.Item.name?.S;
  
  const bookingParams = {
    TableName: "kn_slot_booked",
    KeyConditionExpression: "phoneNumber = :p",
    ExpressionAttributeValues: {
      ":p": { S: phoneNumber }
    }
  };

  const bookingResult = await client.send(
    new QueryCommand(bookingParams)
  );
  
  if (bookingResult.Items && bookingResult.Items.length > 0) {
    return {
      userType: "OLD",
      name: name,
      isScheduled: "YES"
    };
  }
  
  return {
    userType: "OLD",
    name: name,
    isScheduled: "NO"
  };

} catch (error) {
  console.log(error);
  throw error;
}
};
