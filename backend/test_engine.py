import pandas as pd
from sklearn.metrics import classification_report
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, DBExceptionRecord
from anomaly_detector import AnomalyDetector
from datetime import datetime

def norm_name(name: str) -> str:
    if not name:
        return ""
    cleaned = name.lower().replace(".", " ").replace("_", " ")
    return " ".join(cleaned.strip().split())

def assess():
    # 1. Create an in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Load the exception registry
        df = pd.read_csv('sample_data/exception_registry.csv')
        
        # Ingest into the SQLite database
        for _, row in df.iterrows():
            start_date_parsed = None
            if pd.notna(row['request_date']):
                start_date_parsed = datetime.strptime(str(row['request_date']).strip(), "%Y-%m-%d").date()
                
            end_date_parsed = None
            if pd.notna(row['expiry_date']):
                end_date_parsed = datetime.strptime(str(row['expiry_date']).strip(), "%Y-%m-%d").date()
                
            is_renewed_val = str(row['is_renewed']).strip().lower()
            renewal_count_val = 1 if is_renewed_val in ['true', '1'] else 0
            
            requester_name = str(row['requester_name']) if pd.notna(row['requester_name']) else ""
            approver_name = str(row['approver_name']) if pd.notna(row['approver_name']) else ""
            
            db_record = DBExceptionRecord(
                exception_id=str(row['exception_id']),
                type=str(row['exception_type']),
                requester=norm_name(requester_name),
                approver=norm_name(approver_name),
                justification=str(row['justification']) if pd.notna(row['justification']) else "",
                start_date=start_date_parsed,
                end_date=end_date_parsed,
                status=str(row['status']) if pd.notna(row['status']) else "ACTIVE",
                risk_level=str(row['risk_level']) if pd.notna(row['risk_level']) else "LOW",
                renewal_count=renewal_count_val
            )
            db.add(db_record)
        db.commit()
        
        # 2. Initialize anomaly detector
        detector = AnomalyDetector()
        detected_anomalies = detector.detect(db)
        
        # 3. Collect all unique exception_ids that triggered an anomaly
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

    # Get the flagged IDs from our assessment
    print("Scanning CSV exception registry via AnomalyDetector...")
    flagged_ids = assess()

    # Map the predictions: 1 if your engine flagged the ID, 0 if it didn't
    labels['predicted_anomaly'] = labels['record_id'].apply(
        lambda x: 1 if x in flagged_ids else 0
    )

    # Ensure labels is_anomaly is boolean
    labels['is_anomaly'] = labels['is_anomaly'].astype(bool)

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