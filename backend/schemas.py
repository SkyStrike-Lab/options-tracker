from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class TransactionBase(BaseModel):
    date: datetime
    transaction_type: str
    quantity: int
    option_price: float
    commission: float
    total_usd: float

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    transaction_type: Optional[str] = None
    quantity: Optional[int] = None
    option_price: Optional[float] = None
    commission: Optional[float] = None
    total_usd: Optional[float] = None

class Transaction(TransactionBase):
    id: int
    position_id: int

    class Config:
        from_attributes = True

class LegCreate(BaseModel):
    contract_name: str
    strike_price: float
    call_put: str
    transaction_type: str # BTO, STO
    option_price: float
    commission: float
    total_usd: float

class PositionCreateBatch(BaseModel):
    symbol: str
    date_opened: datetime
    expiration_date: datetime
    quantity: int
    max_loss: float
    multiplier: float = 100.0
    legs: List[LegCreate]

class PositionUpdate(BaseModel):
    symbol: Optional[str] = None
    campaign_id: Optional[str] = None
    rolled_from_id: Optional[int] = None
    roll_count: Optional[int] = None
    date_opened: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    contract_name: Optional[str] = None
    strike_price: Optional[float] = None
    call_put: Optional[str] = None
    initial_type: Optional[str] = None
    current_quantity: Optional[int] = None
    total_cost_usd: Optional[float] = None
    max_loss: Optional[float] = None
    multiplier: Optional[float] = None
    status: Optional[str] = None
    realized_pnl_usd: Optional[float] = None
    outcome: Optional[str] = None
    effective_stock_basis: Optional[float] = None
    close_notes: Optional[str] = None

class Position(BaseModel):
    id: int
    group_id: str
    campaign_id: Optional[str] = None
    rolled_from_id: Optional[int] = None
    roll_count: int = 0
    campaign_realized_pnl: Optional[float] = None
    date_opened: datetime
    symbol: str
    expiration_date: Optional[datetime] = None
    contract_name: str
    strike_price: Optional[float] = None
    call_put: Optional[str] = None
    initial_type: str
    status: str
    multiplier: float = 100.0
    current_quantity: int
    total_cost_usd: float
    max_loss: Optional[float] = 0.0
    realized_pnl_usd: float
    transactions: List[Transaction] = []
    ib_current_price: Optional[float] = None
    ib_unrealized_profits: Optional[float] = None
    occ_symbol: Optional[str] = None
    outcome: Optional[str] = None
    effective_stock_basis: Optional[float] = None
    close_notes: Optional[str] = None
    has_assigned_leg: Optional[bool] = False
    cash_flow_pnl_usd: Optional[float] = 0.0
    broker_adjusted_pnl_usd: Optional[float] = 0.0

    class Config:
        from_attributes = True

class ClosePositionRequest(BaseModel):
    date: datetime
    transaction_type: str
    quantity: int
    option_price: float
    commission: float
    total_usd: float
    outcome: Optional[str] = "TRADED"
    effective_stock_basis: Optional[float] = None
    close_notes: Optional[str] = None

class PositionsMetadata(BaseModel):
    ib_report_datetime: Optional[str] = None

class PositionsResponse(BaseModel):
    metadata: PositionsMetadata
    positions: List[Position]

class IngestLeg(BaseModel):
    symbol: Optional[str] = None
    contract_name: Optional[str] = None
    expiration_date: Optional[datetime] = None
    strike_price: Optional[float] = None
    call_put: Optional[str] = None # Call, Put, CALL, PUT
    action: Optional[str] = None # BUY, SELL, BTO, STO, BTC, STC, Bought, Sold
    transaction_type: Optional[str] = None # BTO, STO, BTC, STC
    quantity: Optional[int] = 1
    option_price: float
    commission: float = 0.0
    total_usd: Optional[float] = None
    occ_symbol: Optional[str] = None
    realized_pnl: Optional[float] = None

class IngestRequest(BaseModel):
    symbol: Optional[str] = None
    date: Optional[datetime] = None
    date_opened: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    quantity: Optional[int] = 1
    multiplier: float = 100.0
    max_loss: Optional[float] = None
    campaign_id: Optional[str] = None
    rolled_from_id: Optional[int] = None
    legs: List[IngestLeg]

class IngestResultItem(BaseModel):
    action_taken: str # "OPENED", "CLOSED", "SKIPPED_WARNING", "FAILED"
    position_id: Optional[int] = None
    transaction_type: str # BTO, STO, BTC, STC, UNKNOWN
    occ_symbol: Optional[str] = None
    contract_name: Optional[str] = None
    quantity: int
    position: Optional[Position] = None
    warning: Optional[str] = None

class IngestResponse(BaseModel):
    status: str # "success", "partial_success", "warning", "error"
    message: str
    warnings: List[str] = []
    results: List[IngestResultItem]


class RollPositionRequest(BaseModel):
    date: datetime
    close_transaction_type: str # BTC or STC
    close_price: float
    close_commission: float = 0.0
    close_total_usd: Optional[float] = None
    
    # New leg to open
    new_expiration_date: datetime
    new_strike_price: float
    new_call_put: str # Call or Put
    new_transaction_type: str # STO or BTO
    new_option_price: float
    new_commission: float = 0.0
    new_total_usd: Optional[float] = None
    new_contract_name: Optional[str] = None


class RollGroupLegItem(BaseModel):
    position_id: int
    close_transaction_type: str # BTC or STC
    close_price: float
    close_commission: float = 0.0
    close_total_usd: Optional[float] = None

    # New leg to open
    new_strike_price: float
    new_call_put: str # Call or Put
    new_transaction_type: str # STO or BTO
    new_option_price: float
    new_commission: float = 0.0
    new_total_usd: Optional[float] = None
    new_contract_name: Optional[str] = None


class RollGroupRequest(BaseModel):
    date: datetime
    new_expiration_date: datetime
    max_loss: Optional[float] = None
    legs: List[RollGroupLegItem]

class TickerSummary(BaseModel):
    symbol: str
    trades: int
    wins: int
    losses: int
    win_rate: float
    cash_pnl: float
    broker_pnl: float
    avg_hold_days: float

class MonthlySummary(BaseModel):
    month: str
    trades: int
    cash_pnl: float
    broker_pnl: float

class LifetimeSummaryResponse(BaseModel):
    total_trades: int
    total_legs: int
    wins: int
    losses: int
    ties: int
    win_rate: float
    cash_pnl: float
    broker_pnl: float
    gross_profit: float
    gross_loss: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    avg_hold_days: float
    total_commissions: float
    total_premium_harvested: float
    net_credit_opened: float = 0.0
    premium_capture_rate: float = 0.0
    outcomes: dict
    monthly: List[MonthlySummary]
    tickers: List[TickerSummary]

class DeliveryMemo(BaseModel):
    delivery_id: str  # e.g. "delivery-61"
    position_id: int  # 61
    group_id: str
    campaign_id: Optional[str] = None
    symbol: str
    contract_name: str
    delivery_type: str  # "ASSIGNED", "CALLED_AWAY", or "EXERCISED"
    action: str  # "BUY" (for put assignments or call exercises) or "SELL" (for call called away or put exercises)
    shares: int  # Signed or count: e.g. 100 for BUY, -100 for SELL
    shares_count: int  # Absolute count e.g. 100
    strike_price: Optional[float] = None
    effective_basis: Optional[float] = None
    option_premium_per_share: Optional[float] = None
    total_premium_usd: Optional[float] = None
    settlement_date: Optional[str] = None  # YYYY-MM-DD
    cash_flow_pnl_usd: Optional[float] = 0.0
    broker_adjusted_pnl_usd: Optional[float] = 0.0
    notes: Optional[str] = None

    class Config:
        from_attributes = True
