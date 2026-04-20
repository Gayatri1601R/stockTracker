import React from "react";
import { View, Text } from "react-native";

export default function ItemDetailsScreen({ route }) {
  const { item } = route.params;

  const baseline = item.baseline_daily_usage || 0;
  const daysLeft = baseline > 0
    ? Math.floor(item.remaining_quantity / baseline)
    : null;

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20 }}>{item.name}</Text>

      <Text>Total Purchased: {item.purchased_quantity}</Text>
      <Text>Remaining: {item.remaining_quantity}</Text>
      <Text>Unit: {item.unit}</Text>
      <Text>Period: {item.period}</Text>
      <Text>Baseline Per Day: {baseline || "Not set"}</Text>
      <Text>Days Left: {daysLeft === null ? "Unknown" : daysLeft}</Text>
    </View>
  );
}
