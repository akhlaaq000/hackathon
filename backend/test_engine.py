import pandas as pd
from sklearn.metrics import classification_report

# Import your database session and your detector class
# (If your database session variable is named differently, adjust the import below)
from database import SessionLocal 
from anomaly_detector import AnomalyDetector

def assess():
    # 1. Open a connection to your FastAPI database
    db = SessionLocal()
    
    try:
        # 2. Initialize your engine and scan the database
        detector = AnomalyDetector()
        detected_anomalies = detector.detect(db)
        
        # 3. Collect all unique exception_ids that triggered an anomaly
        # Note: We ignore aggregate alerts (like RISK_ACCUMULATION) because 
        # Scikit-Learn evaluates row-by-row accuracy, not global user risks.
        flagged_ids = set()
        for anomaly in detected_anomalies:
            if anomaly.get("exception_id") is not None:
                flagged_ids.add(anomaly["exception_id"])
                
        return flagged_ids
    finally:
        db.close()

if __name__ == "__main__":
    # Load the answer key
    labels = pd.read_csv('sample_data/exception_labels.csv')

    # Get the flagged IDs from your actual engine
    print("Scanning database via AnomalyDetector...")
    flagged_ids = assess()

    # Map the predictions: 1 if your engine flagged the ID, 0 if it didn't
    labels['predicted_anomaly'] = labels['exception_id'].apply(
        lambda x: 1 if x in flagged_ids else 0
    )

    # Print the Scikit-Learn grading report
    print("\n--- GRADING REPORT ---")
    print(
        classification_report(
            labels['is_anomaly'],
            labels['predicted_anomaly'],
            target_names=['Compliant', 'At-Risk Exception']
        )
    )
    
    # Print the Critical catch rate
    critical = labels[labels['severity'] == 'CRITICAL']
    critical_caught = labels.loc[critical.index]['predicted_anomaly'].sum()
    print(f"Critical exception detection rate: {critical_caught}/{len(critical)}")