import pandas as pd
from anomaly_detector import AnomalyDetector

from database import SessionLocal

# 1. Load ground truth
labels = pd.read_csv('sample_data/exception_labels.csv')
critical_labels = labels[labels['severity'] == 'CRITICAL']

# 2. Run your engine
db = SessionLocal()
detector = AnomalyDetector()
predictions = detector.detect(db)
db.close()

# 3. Find what we missed
predicted_critical_ids = [p['exception_id'] for p in predictions if p['severity'] == 'CRITICAL']
missed_criticals = critical_labels[~critical_labels['record_id'].isin(predicted_critical_ids)]

print("--- MISSED CRITICAL EXCEPTIONS ---")
print(missed_criticals[['record_id', 'anomaly_type', 'explanation']])
