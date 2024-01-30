import yfinance as yf
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import json
import sys

msft = sys.argv[1]
msft = yf.Ticker(msft)

msft = msft.history(period="MAX")

del msft['Dividends']
del msft['Stock Splits']
msft["Next-Week"] = msft["Close"].shift(-5)
msft = msft.loc["1990-01-01":].copy()

horizons = [2,5,60,250,1000]
predictors = []

for horizon in horizons:
    rolling_averages = msft.rolling(horizon).mean()

    ratio_column = f"Close_Ratio_{horizon}"
    msft[ratio_column] = msft["Close"] / rolling_averages["Close"]

    predictors += [ratio_column]




model = RandomForestRegressor(random_state=1, n_estimators=100)
train = msft.iloc[1000:-1000]
test = msft.iloc[-1000: -1]
test_res = msft.iloc[-1:]
model.fit(train[predictors], train["Next-Week"])

preds = model.predict(test[predictors])
preds_res = model.predict(test_res[predictors])

actual_closed_values = test["Close"].values
test_copy = test.copy()
test_copy["Predicted"] = preds

accuracy_percentage = round(np.mean(np.abs((actual_closed_values - preds) / actual_closed_values)) * 100,2)

three_weeks_data = msft.iloc[-15:]


latest_date = pd.to_datetime(three_weeks_data.index[-1])
next_working_day = pd.date_range(start=latest_date + pd.Timedelta(days=1), periods=1, freq='B')[0]
date_range = pd.date_range(start=next_working_day, periods=5, freq='B')
new_data = pd.DataFrame(index=date_range)
new_data['price'] = np.nan
total_data = pd.concat([three_weeks_data, new_data])

json_output = total_data.apply(lambda row: {"date": row.name.strftime("%d-%m-%y"), "price": round(row["Close"],2)}, axis=1).to_list()

json_output[-1]['price'] = round(float(preds_res[0]),2)
json_output_2 = [{"accuracy": accuracy_percentage}]
final_json_output = [json_output, json_output_2]
final_json_output = json.dumps(final_json_output)

print(final_json_output)
