import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });

function to24Hour(time12) {
  const [time, modifier] = time12.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (modifier === "PM" && h !== 12) h += 12;
  if (modifier === "AM" && h === 12) h = 0;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export const handler = async (event) => {

  console.log(event.Details.ContactData.Attributes); 

  try {
    const { customerName, selectedDay, selectedTime } = event.Details.ContactData.Attributes;
    const phoneNumber  = event.Details.ContactData.CustomerEndpoint.Address;

    console.log(phoneNumber, customerName, selectedDay, selectedTime);

    const date = new Date();
    if (selectedDay === "tomorrow") {
      date.setDate(date.getDate() + 1);
    }
    const slotDate = date.toISOString().split("T")[0];
    const slotTime24 = to24Hour(selectedTime);

    const customer = await client.send(
      new GetItemCommand({
        TableName: "kn_customers",
        Key: { phoneNumber: { S: phoneNumber } }
      })
    );

    // create new customer
    if (!customer.Item) {
      await client.send(
        new PutItemCommand({
          TableName: "kn_customers",
          Item: {
            phoneNumber: { S: phoneNumber },
            name: { S: name }
          }
        })
      );
    }

    // update the slot
    await client.send(
      new UpdateItemCommand({
        TableName: "kn_available_slots",
        Key: {
          slotDate: { S: slotDate },
          slotTime: { S: slotTime24 }
        },
        UpdateExpression: "SET isAvailable = :false",
        ConditionExpression: "isAvailable = :true",
        ExpressionAttributeValues: {
          ":false": { BOOL: false },
          ":true": { BOOL: true }
        }
      })
    );

    //Save booking
    await client.send(
      new PutItemCommand({
        TableName: "kn_slot_booked",
        Item: {
          phoneNumber: { S: phoneNumber },
          slotDate: { S: slotDate },
          slotTime: { S: slotTime24 },
          status: { S: "BOOKED" }
        }
      })
    );

    return {
      status: "SUCCESS",
      slotDate,
      slotTime: selectedTime
    };

  } catch (error) {
    console.error(error);
    return 
    { status: "FAILED" };
  }
};
