from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("options_tracker")

def get_positions(db: Session, status: str = None):
    query = db.query(models.Position)
    if status:
        query = query.filter(models.Position.status == status)
    positions = query.all()
    campaign_pnls = dict(
        db.query(models.Position.campaign_id, func.sum(models.Position.realized_pnl_usd))
        .filter(models.Position.status == "Closed", models.Position.campaign_id != None)
        .group_by(models.Position.campaign_id)
        .all()
    )
    assigned_groups = set(
        gid for (gid,) in db.query(models.Position.group_id)
        .filter(models.Position.status == "Closed", models.Position.outcome.in_(["ASSIGNED", "CALLED_AWAY"]))
        .all() if gid
    )
    assigned_campaigns = set(
        cid for (cid,) in db.query(models.Position.campaign_id)
        .filter(models.Position.status == "Closed", models.Position.outcome.in_(["ASSIGNED", "CALLED_AWAY"]))
        .all() if cid
    )
    for p in positions:
        cid = p.campaign_id or p.group_id
        p.campaign_realized_pnl = campaign_pnls.get(cid, 0.0)
        p.has_assigned_leg = (p.group_id in assigned_groups) or (cid in assigned_campaigns)
    return positions

def recalculate_position(db: Session, position_id: int):
    logger.debug("Recalculating position ID %s", position_id)
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        logger.warning("Position ID %s not found for recalculation", position_id)
        return None
    
    transactions = db.query(models.Transaction).filter(models.Transaction.position_id == position_id).all()
    
    total_qty = 0
    total_usd = 0.0
    
    for t in transactions:
        total_usd += t.total_usd
        if t.transaction_type in ['BTO', 'STO']:
            total_qty += t.quantity
        else:
            total_qty -= t.quantity
            
    db_position.current_quantity = total_qty
    db_position.total_cost_usd = total_usd
    
    if total_qty <= 0:
        db_position.status = "Closed"
        db_position.realized_pnl_usd = total_usd
        if not db_position.outcome:
            db_position.outcome = "TRADED"
    else:
        db_position.status = "Open"
        db_position.realized_pnl_usd = 0.0
        db_position.outcome = None
        
    db.commit()
    db.refresh(db_position)
    logger.info("Recalculated position ID %s successfully (status: %s, quantity: %s)", position_id, db_position.status, total_qty)
    return db_position

def create_positions_batch(db: Session, batch: schemas.PositionCreateBatch):
    logger.info("Batch creating positions: %s legs for symbol %s", len(batch.legs), batch.symbol)
    group_id = str(uuid.uuid4())
    created_positions = []
    
    for leg in batch.legs:
        ticker = batch.symbol.upper() if batch.symbol else ""
        exp_str = batch.expiration_date.strftime("%y%m%d") if batch.expiration_date else ""
        cp_char = leg.call_put[0].upper() if leg.call_put else ""
        strike_str = f"{int(leg.strike_price * 1000):08d}" if leg.strike_price is not None else ""
        occ = f"{ticker}{exp_str}{cp_char}{strike_str}" if (ticker and exp_str and cp_char and strike_str) else None

        db_position = models.Position(
            group_id=group_id,
            campaign_id=group_id,
            roll_count=0,
            symbol=batch.symbol,
            date_opened=batch.date_opened,
            expiration_date=batch.expiration_date,
            contract_name=leg.contract_name,
            strike_price=leg.strike_price,
            call_put=leg.call_put,
            initial_type=leg.transaction_type,
            status="Open",
            multiplier=batch.multiplier,
            current_quantity=batch.quantity,
            total_cost_usd=leg.total_usd,
            max_loss=batch.max_loss,
            occ_symbol=occ
        )
        db.add(db_position)
        db.commit()
        db.refresh(db_position)

        # Create initial transaction
        db_transaction = models.Transaction(
            position_id=db_position.id,
            date=batch.date_opened,
            transaction_type=leg.transaction_type,
            quantity=batch.quantity,
            option_price=leg.option_price,
            commission=leg.commission,
            total_usd=leg.total_usd
        )
        db.add(db_transaction)
        db.commit()
        created_positions.append(db_position)
        
    return created_positions

def update_transaction(db: Session, transaction_id: int, trans_update: schemas.TransactionUpdate):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        return None
    
    update_data = trans_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_transaction, key, value)
    
    db.commit()
    db.refresh(db_transaction)
    
    # Sync parent position
    recalculate_position(db, db_transaction.position_id)
    
    return db_transaction

def update_position(db: Session, position_id: int, pos_update: schemas.PositionUpdate):
    logger.info("Updating position ID %s", position_id)
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        logger.warning("Position ID %s not found for update", position_id)
        return None
    
    update_data = pos_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_position, key, value)
        
    # Re-calculate occ_symbol if any relevant fields changed
    ticker = db_position.symbol.upper() if db_position.symbol else ""
    if db_position.expiration_date and db_position.call_put and db_position.strike_price is not None:
        exp_str = db_position.expiration_date.strftime("%y%m%d")
        cp_char = db_position.call_put[0].upper()
        strike_str = f"{int(db_position.strike_price * 1000):08d}"
        db_position.occ_symbol = f"{ticker}{exp_str}{cp_char}{strike_str}"
    
    db.commit()
    db.refresh(db_position)
    return db_position

def close_position(db: Session, position_id: int, close_req: schemas.ClosePositionRequest):
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        return None

    db_position.outcome = close_req.outcome or "TRADED"
    db_position.effective_stock_basis = close_req.effective_stock_basis
    db_position.close_notes = close_req.close_notes

    # Add transaction
    db_transaction = models.Transaction(
        position_id=position_id,
        date=close_req.date,
        transaction_type=close_req.transaction_type,
        quantity=close_req.quantity,
        option_price=close_req.option_price,
        commission=close_req.commission,
        total_usd=close_req.total_usd
    )
    db.add(db_transaction)
    db.commit()

    # Recalculate everything
    return recalculate_position(db, position_id)

def delete_position(db: Session, position_id: int):
    db.query(models.Transaction).filter(models.Transaction.position_id == position_id).delete()
    db.query(models.Position).filter(models.Position.id == position_id).delete()
    db.commit()

def delete_group(db: Session, group_id: str):
    positions = db.query(models.Position).filter(models.Position.group_id == group_id).all()
    for p in positions:
        db.query(models.Transaction).filter(models.Transaction.position_id == p.id).delete()
    db.query(models.Position).filter(models.Position.group_id == group_id).delete()
    db.commit()

def delete_transaction(db: Session, transaction_id: int):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not db_transaction:
        return None
    position_id = db_transaction.position_id
    db.delete(db_transaction)
    db.commit()
    return recalculate_position(db, position_id)

def reopen_position(db: Session, position_id: int):
    db_position = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not db_position:
        return None
    db.query(models.Transaction).filter(
        models.Transaction.position_id == position_id,
        models.Transaction.transaction_type.notin_(['BTO', 'STO'])
    ).delete(synchronize_session=False)
    db_position.outcome = None
    db_position.effective_stock_basis = None
    db_position.close_notes = None
    db.commit()
    return recalculate_position(db, position_id)

def reopen_group(db: Session, group_id: str):
    positions = db.query(models.Position).filter(models.Position.group_id == group_id).all()
    if not positions:
        return None
    for pos in positions:
        db.query(models.Transaction).filter(
            models.Transaction.position_id == pos.id,
            models.Transaction.transaction_type.notin_(['BTO', 'STO'])
        ).delete(synchronize_session=False)
        pos.outcome = None
        pos.effective_stock_basis = None
        pos.close_notes = None
        db.commit()
        recalculate_position(db, pos.id)
    return positions

def compute_occ_symbol(symbol: str, expiration_date: datetime, call_put: str, strike_price: float) -> Optional[str]:
    if not (symbol and expiration_date and call_put and strike_price is not None):
        return None
    ticker = symbol.upper()
    exp_str = expiration_date.strftime("%y%m%d")
    cp_char = call_put[0].upper()
    strike_str = f"{int(round(strike_price * 1000)):08d}"
    return f"{ticker}{exp_str}{cp_char}{strike_str}"

def format_contract_name(expiration_date: datetime, strike_price: float, call_put: str) -> str:
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    mmm = months[expiration_date.month - 1]
    dd = f"{expiration_date.day:02d}"
    yy = f"{expiration_date.year % 100:02d}"
    strike_display = f"{strike_price:g}"
    cp_display = "Call" if call_put.upper().startswith("C") else "Put"
    return f"{mmm} {dd} '{yy} {strike_display} {cp_display}"

def ingest_transaction_batch(db: Session, request: schemas.IngestRequest) -> schemas.IngestResponse:
    effective_date = request.date or request.date_opened or datetime.utcnow()
    effective_exp = request.expiration_date
    logger.info("Ingesting batch transactions for symbol=%s with %d legs", request.symbol, len(request.legs))
    results = []
    warnings = []

    # First pass: classify each leg as OPEN or CLOSE
    legs_to_close = []
    legs_to_open = []

    for leg in request.legs:
        leg_symbol = (leg.symbol or request.symbol or "").upper()
        leg_exp = leg.expiration_date or effective_exp
        
        # Normalize call_put to title case ("Call", "Put")
        raw_cp = leg.call_put or ("Call" if "C" in (leg.contract_name or "").upper() else "Put")
        normalized_cp = "Call" if raw_cp.strip().upper().startswith("C") else "Put"

        occ = leg.occ_symbol
        if not occ and leg_symbol and leg_exp and leg.strike_price is not None:
            occ = compute_occ_symbol(leg_symbol, leg_exp, normalized_cp, leg.strike_price)
            
        action_clean = (leg.action or leg.transaction_type or "").upper().strip()
        is_buy = action_clean in ("BUY", "BOUGHT", "BTO", "BTC")
        is_sell = action_clean in ("SELL", "SOLD", "STO", "STC")

        # Check if caller explicitly gave close instruction (or realized_pnl provided)
        has_explicit_close = action_clean in ("BTC", "STC") or (leg.realized_pnl is not None and leg.realized_pnl != 0.0)

        # Lookup open position by OCC symbol (or contract / symbol match)
        open_pos = None
        if occ:
            open_pos = db.query(models.Position).filter(
                models.Position.occ_symbol == occ,
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()
        
        if not open_pos and leg_symbol and leg_exp and leg.strike_price is not None:
            open_pos = db.query(models.Position).filter(
                models.Position.symbol == leg_symbol,
                models.Position.expiration_date == leg_exp,
                models.Position.strike_price == leg.strike_price,
                models.Position.call_put.ilike(normalized_cp),
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()

        # Decision: Close vs Open
        # 1. Explicit close action (e.g. BTC, STC)
        # 2. Or matching open position exists and trade direction opposes current position
        is_close_trade = False
        if has_explicit_close:
            is_close_trade = True
        elif open_pos:
            if open_pos.initial_type in ("STO", "BTC") and is_buy:
                is_close_trade = True
            elif open_pos.initial_type in ("BTO", "STC") and is_sell:
                is_close_trade = True
        
        if is_close_trade and not open_pos:
            # Fallback search if open_pos wasn't found by exact strike/exp match: match by symbol & status
            fallback_pos = db.query(models.Position).filter(
                models.Position.symbol == leg_symbol,
                models.Position.status == "Open",
                models.Position.current_quantity > 0
            ).first()
            if fallback_pos:
                open_pos = fallback_pos

        if is_close_trade and open_pos:
            legs_to_close.append((leg, open_pos, is_buy, occ, leg_symbol, leg_exp, normalized_cp))
        elif is_close_trade and not open_pos:
            # Explicit closing trade but no open position exists
            contract_desc = leg.contract_name or occ or f"{leg_symbol} {leg.strike_price} {normalized_cp}"
            warn_msg = f"Cannot close position: No matching open position found for {contract_desc} ({action_clean})"
            logger.warning(warn_msg)
            warnings.append(warn_msg)
            results.append(schemas.IngestResultItem(
                action_taken="SKIPPED_WARNING",
                transaction_type=action_clean or ("BTC" if is_buy else "STC"),
                occ_symbol=occ,
                contract_name=leg.contract_name or contract_desc,
                quantity=leg.quantity or request.quantity or 1,
                warning=warn_msg
            ))
        else:
            legs_to_open.append((leg, is_buy, occ, leg_symbol, leg_exp, normalized_cp))

    # Process all closes
    for leg, pos, is_buy, occ, leg_symbol, leg_exp, norm_cp in legs_to_close:
        close_tx_type = "BTC" if is_buy else "STC"
        qty = leg.quantity or request.quantity or 1
        multiplier = pos.multiplier or request.multiplier or 100.0
        
        if leg.total_usd is not None:
            total_usd = leg.total_usd
        else:
            gross = qty * leg.option_price * multiplier
            total_usd = -(gross + leg.commission) if is_buy else (gross - leg.commission)

        close_req = schemas.ClosePositionRequest(
            date=effective_date,
            transaction_type=close_tx_type,
            quantity=qty,
            option_price=leg.option_price,
            commission=leg.commission,
            total_usd=total_usd
        )
        updated_pos = close_position(db, pos.id, close_req)
        results.append(schemas.IngestResultItem(
            action_taken="CLOSED",
            position_id=updated_pos.id,
            transaction_type=close_tx_type,
            occ_symbol=updated_pos.occ_symbol or occ,
            contract_name=updated_pos.contract_name,
            quantity=qty,
            position=updated_pos
        ))

    # Process all opens (grouped together under one group_id)
    if legs_to_open:
        group_id = str(uuid.uuid4())
        group_symbol = request.symbol or legs_to_open[0][3] or "UNKNOWN"
        group_exp = effective_exp or legs_to_open[0][4] or effective_date
        max_loss = request.max_loss if request.max_loss is not None else 0.0

        for leg, is_buy, occ, leg_symbol, leg_exp, norm_cp in legs_to_open:
            open_tx_type = "BTO" if is_buy else "STO"
            qty = leg.quantity or request.quantity or 1
            multiplier = request.multiplier or 100.0
            strike = leg.strike_price or 0.0
            cp = norm_cp
            exp_date = leg_exp or group_exp
            
            c_name = leg.contract_name
            if not c_name and exp_date and strike:
                c_name = format_contract_name(exp_date, strike, cp)
            elif not c_name:
                c_name = f"{leg_symbol} {strike} {cp}"

            if not occ and leg_symbol and exp_date and cp and strike:
                occ = compute_occ_symbol(leg_symbol, exp_date, cp, strike)

            if leg.total_usd is not None:
                total_usd = leg.total_usd
            else:
                gross = qty * leg.option_price * multiplier
                total_usd = -(gross + leg.commission) if is_buy else (gross - leg.commission)

            # Check if matching closed position exists in this batch or via explicit rolled_from_id
            matching_closed = None
            if legs_to_close:
                for item in results:
                    if item.action_taken == "CLOSED" and item.position:
                        if item.position.symbol == (leg_symbol or group_symbol):
                            matching_closed = item.position
                            break
            if not matching_closed and getattr(request, 'rolled_from_id', None):
                matching_closed = db.query(models.Position).filter(models.Position.id == request.rolled_from_id).first()

            campaign_id = request.campaign_id if getattr(request, 'campaign_id', None) else (
                (matching_closed.campaign_id or matching_closed.group_id) if matching_closed else group_id
            )
            rolled_from_id = matching_closed.id if matching_closed else getattr(request, 'rolled_from_id', None)
            roll_count = (matching_closed.roll_count or 0) + 1 if matching_closed else 0

            db_pos = models.Position(
                group_id=group_id,
                campaign_id=campaign_id,
                rolled_from_id=rolled_from_id,
                roll_count=roll_count,
                symbol=leg_symbol or group_symbol,
                date_opened=effective_date,
                expiration_date=exp_date,
                contract_name=c_name,
                strike_price=strike,
                call_put=cp,
                initial_type=open_tx_type,
                status="Open",
                multiplier=multiplier,
                current_quantity=qty,
                total_cost_usd=total_usd,
                max_loss=max_loss,
                occ_symbol=occ
            )
            db.add(db_pos)
            db.commit()
            db.refresh(db_pos)

            db_tx = models.Transaction(
                position_id=db_pos.id,
                date=effective_date,
                transaction_type=open_tx_type,
                quantity=qty,
                option_price=leg.option_price,
                commission=leg.commission,
                total_usd=total_usd
            )
            db.add(db_tx)
            db.commit()
            db.refresh(db_pos)

            results.append(schemas.IngestResultItem(
                action_taken="OPENED",
                position_id=db_pos.id,
                transaction_type=open_tx_type,
                occ_symbol=occ,
                contract_name=c_name,
                quantity=qty,
                position=db_pos
            ))

    processed_count = len(legs_to_close) + len(legs_to_open)
    if warnings and processed_count > 0:
        overall_status = "partial_success"
    elif warnings and processed_count == 0:
        overall_status = "warning"
    else:
        overall_status = "success"

    msg = f"Processed {processed_count} transactions ({len(legs_to_close)} closed, {len(legs_to_open)} opened, {len(warnings)} skipped with warning)"
    logger.info(msg)
    return schemas.IngestResponse(
        status=overall_status,
        message=msg,
        warnings=warnings,
        results=results
    )


def roll_position(db: Session, position_id: int, roll_req: schemas.RollPositionRequest):
    old_pos = db.query(models.Position).filter(models.Position.id == position_id).first()
    if not old_pos:
        raise ValueError(f"Position {position_id} not found")
    if old_pos.status != "Open":
        raise ValueError(f"Position {position_id} is already closed")
    
    qty = old_pos.current_quantity
    is_close_buy = roll_req.close_transaction_type.upper() in ("BTC", "BTO", "BUY", "BOUGHT")
    close_total_usd = roll_req.close_total_usd
    if close_total_usd is None:
        close_gross = qty * roll_req.close_price * (old_pos.multiplier or 100.0)
        close_total_usd = -(close_gross + roll_req.close_commission) if is_close_buy else (close_gross - roll_req.close_commission)
        
    close_req = schemas.ClosePositionRequest(
        date=roll_req.date,
        transaction_type=roll_req.close_transaction_type,
        quantity=qty,
        option_price=roll_req.close_price,
        commission=roll_req.close_commission,
        total_usd=close_total_usd
    )
    closed_pos = close_position(db, old_pos.id, close_req)
    
    new_group_id = str(uuid.uuid4())
    campaign_id = old_pos.campaign_id or old_pos.group_id
    new_roll_count = (old_pos.roll_count or 0) + 1
    new_cp = "Call" if roll_req.new_call_put.strip().upper().startswith("C") else "Put"
    new_contract_name = roll_req.new_contract_name or format_contract_name(roll_req.new_expiration_date, roll_req.new_strike_price, new_cp)
    new_occ = compute_occ_symbol(old_pos.symbol, roll_req.new_expiration_date, new_cp, roll_req.new_strike_price)
    
    is_open_buy = roll_req.new_transaction_type.upper() in ("BTO", "BUY", "BOUGHT")
    new_total_usd = roll_req.new_total_usd
    if new_total_usd is None:
        new_gross = qty * roll_req.new_option_price * (old_pos.multiplier or 100.0)
        new_total_usd = -(new_gross + roll_req.new_commission) if is_open_buy else (new_gross - roll_req.new_commission)
        
    new_pos = models.Position(
        group_id=new_group_id,
        campaign_id=campaign_id,
        rolled_from_id=old_pos.id,
        roll_count=new_roll_count,
        symbol=old_pos.symbol,
        date_opened=roll_req.date,
        expiration_date=roll_req.new_expiration_date,
        contract_name=new_contract_name,
        strike_price=roll_req.new_strike_price,
        call_put=new_cp,
        initial_type=roll_req.new_transaction_type,
        status="Open",
        multiplier=old_pos.multiplier,
        current_quantity=qty,
        total_cost_usd=new_total_usd,
        max_loss=old_pos.max_loss,
        occ_symbol=new_occ
    )
    db.add(new_pos)
    db.commit()
    db.refresh(new_pos)
    
    new_tx = models.Transaction(
        position_id=new_pos.id,
        date=roll_req.date,
        transaction_type=roll_req.new_transaction_type,
        quantity=qty,
        option_price=roll_req.new_option_price,
        commission=roll_req.new_commission,
        total_usd=new_total_usd
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_pos)
    
    return {"closed_position": closed_pos, "new_position": new_pos}

def roll_group(db: Session, group_id: str, roll_req: schemas.RollGroupRequest):
    old_positions = db.query(models.Position).filter(
        models.Position.group_id == group_id,
        models.Position.status == "Open"
    ).all()
    if not old_positions:
        raise ValueError(f"No open positions found for group {group_id}")
    
    old_pos_map = {p.id: p for p in old_positions}
    for leg in roll_req.legs:
        if leg.position_id not in old_pos_map:
            raise ValueError(f"Position {leg.position_id} does not belong to group {group_id}")

    first_old = old_positions[0]
    symbol = first_old.symbol
    multiplier = first_old.multiplier or 100.0
    campaign_id = first_old.campaign_id or first_old.group_id
    new_roll_count = max((p.roll_count or 0) for p in old_positions) + 1
    new_group_id = str(uuid.uuid4())
    effective_max_loss = roll_req.max_loss if roll_req.max_loss is not None else first_old.max_loss

    closed_positions = []
    new_positions = []

    for leg_req in roll_req.legs:
        old_pos = old_pos_map[leg_req.position_id]
        qty = old_pos.current_quantity
        is_close_buy = leg_req.close_transaction_type.upper() in ("BTC", "BTO", "BUY", "BOUGHT")
        close_total_usd = leg_req.close_total_usd
        if close_total_usd is None:
            close_gross = qty * leg_req.close_price * multiplier
            close_total_usd = -(close_gross + leg_req.close_commission) if is_close_buy else (close_gross - leg_req.close_commission)

        close_req = schemas.ClosePositionRequest(
            date=roll_req.date,
            transaction_type=leg_req.close_transaction_type,
            quantity=qty,
            option_price=leg_req.close_price,
            commission=leg_req.close_commission,
            total_usd=close_total_usd
        )
        closed_pos = close_position(db, old_pos.id, close_req)
        closed_positions.append(closed_pos)

        new_cp = "Call" if leg_req.new_call_put.strip().upper().startswith("C") else "Put"
        new_contract_name = leg_req.new_contract_name or format_contract_name(roll_req.new_expiration_date, leg_req.new_strike_price, new_cp)
        new_occ = compute_occ_symbol(symbol, roll_req.new_expiration_date, new_cp, leg_req.new_strike_price)

        is_open_buy = leg_req.new_transaction_type.upper() in ("BTO", "BUY", "BOUGHT")
        new_total_usd = leg_req.new_total_usd
        if new_total_usd is None:
            new_gross = qty * leg_req.new_option_price * multiplier
            new_total_usd = -(new_gross + leg_req.new_commission) if is_open_buy else (new_gross - leg_req.new_commission)

        new_pos = models.Position(
            group_id=new_group_id,
            campaign_id=campaign_id,
            rolled_from_id=old_pos.id,
            roll_count=new_roll_count,
            symbol=symbol,
            date_opened=roll_req.date,
            expiration_date=roll_req.new_expiration_date,
            contract_name=new_contract_name,
            strike_price=leg_req.new_strike_price,
            call_put=new_cp,
            initial_type=leg_req.new_transaction_type,
            status="Open",
            multiplier=multiplier,
            current_quantity=qty,
            total_cost_usd=new_total_usd,
            max_loss=effective_max_loss,
            occ_symbol=new_occ
        )
        db.add(new_pos)
        db.commit()
        db.refresh(new_pos)

        new_tx = models.Transaction(
            position_id=new_pos.id,
            date=roll_req.date,
            transaction_type=leg_req.new_transaction_type,
            quantity=qty,
            option_price=leg_req.new_option_price,
            commission=leg_req.new_commission,
            total_usd=new_total_usd
        )
        db.add(new_tx)
        db.commit()
        db.refresh(new_pos)
        new_positions.append(new_pos)

    return {
        "closed_positions": closed_positions,
        "new_positions": new_positions,
        "new_group_id": new_group_id,
        "campaign_id": campaign_id,
        "roll_count": new_roll_count
    }

def get_campaign_details(db: Session, campaign_id: str):
    positions = db.query(models.Position).filter(
        (models.Position.campaign_id == campaign_id) | (models.Position.group_id == campaign_id)
    ).order_by(models.Position.date_opened.asc(), models.Position.id.asc()).all()
    if not positions:
        return None
    total_realized = sum((p.realized_pnl_usd or 0.0) for p in positions if p.status == "Closed")
    active_cost = sum((p.total_cost_usd or 0.0) for p in positions if p.status == "Open")
    return {
        "campaign_id": campaign_id,
        "symbol": positions[0].symbol if positions else "",
        "positions": positions,
        "total_realized_pnl": total_realized,
        "active_cost": active_cost
    }

def get_lifetime_summary(db: Session):
    from collections import defaultdict
    closed = db.query(models.Position).filter(models.Position.status == 'Closed').all()
    if not closed:
        return {
            "total_trades": 0,
            "total_legs": 0,
            "wins": 0,
            "losses": 0,
            "ties": 0,
            "win_rate": 0.0,
            "cash_pnl": 0.0,
            "broker_pnl": 0.0,
            "gross_profit": 0.0,
            "gross_loss": 0.0,
            "profit_factor": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "avg_hold_days": 0.0,
            "total_commissions": 0.0,
            "total_premium_harvested": 0.0,
            "outcomes": {},
            "monthly": [],
            "tickers": []
        }

    groups = defaultdict(list)
    for p in closed:
        groups[p.group_id or str(p.id)].append(p)

    total_cash_pnl = 0.0
    total_broker_pnl = 0.0
    gross_profit = 0.0
    gross_loss = 0.0
    total_commissions = 0.0
    total_premium = 0.0
    net_credit_opened = 0.0
    wins = 0
    losses = 0
    ties = 0
    hold_days_list = []
    ticker_stats = defaultdict(lambda: {
        'symbol': '',
        'trades': 0,
        'wins': 0,
        'losses': 0,
        'cash_pnl': 0.0,
        'broker_pnl': 0.0,
        'hold_days': []
    })
    monthly_stats = defaultdict(lambda: {
        'trades': 0,
        'cash_pnl': 0.0,
        'broker_pnl': 0.0
    })
    outcomes_count = defaultdict(int)

    for gid, legs in groups.items():
        symbol = legs[0].symbol
        cash_pnl = sum(p.cash_flow_pnl_usd for p in legs)
        broker_pnl = sum(p.broker_adjusted_pnl_usd for p in legs)

        total_cash_pnl += cash_pnl
        total_broker_pnl += broker_pnl

        if cash_pnl > 0.001:
            wins += 1
            gross_profit += cash_pnl
        elif cash_pnl < -0.001:
            losses += 1
            gross_loss += abs(cash_pnl)
        else:
            ties += 1

        opened_dates = [p.date_opened for p in legs if p.date_opened]
        opened_dt = min(opened_dates) if opened_dates else None

        close_dates = []
        for p in legs:
            for t in p.transactions:
                if t.commission:
                    total_commissions += t.commission
                if t.transaction_type == 'STO':
                    total_premium += abs(t.total_usd)
                    net_credit_opened += t.total_usd
                elif t.transaction_type == 'BTO':
                    net_credit_opened += t.total_usd
                if t.transaction_type in ['BTC', 'STC', 'EXP'] and t.date:
                    close_dates.append(t.date)

        closed_dt = max(close_dates) if close_dates else (legs[0].expiration_date or opened_dt)

        if opened_dt and closed_dt:
            days = max(1, (closed_dt - opened_dt).days)
            hold_days_list.append(days)
            ticker_stats[symbol]['hold_days'].append(days)

        # Month grouping
        month_key = closed_dt.strftime('%Y-%m') if closed_dt else 'Unknown'
        monthly_stats[month_key]['trades'] += 1
        monthly_stats[month_key]['cash_pnl'] += cash_pnl
        monthly_stats[month_key]['broker_pnl'] += broker_pnl

        # Outcome determination
        leg_outcomes = [p.outcome for p in legs if p.outcome]
        if 'ASSIGNED' in leg_outcomes:
            outcome = 'ASSIGNED'
        elif 'CALLED_AWAY' in leg_outcomes:
            outcome = 'CALLED_AWAY'
        elif 'EXPIRED' in leg_outcomes:
            outcome = 'EXPIRED'
        elif cash_pnl < -0.001:
            outcome = 'LOSS'
        else:
            outcome = 'TRADED'
        outcomes_count[outcome] += 1

        # Ticker stats
        ticker_stats[symbol]['symbol'] = symbol
        ticker_stats[symbol]['trades'] += 1
        if cash_pnl > 0.001:
            ticker_stats[symbol]['wins'] += 1
        elif cash_pnl < -0.001:
            ticker_stats[symbol]['losses'] += 1
        ticker_stats[symbol]['cash_pnl'] += cash_pnl
        ticker_stats[symbol]['broker_pnl'] += broker_pnl

    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)
    avg_win = round(gross_profit / wins, 2) if wins > 0 else 0.0
    avg_loss = round(gross_loss / losses, 2) if losses > 0 else 0.0
    avg_hold = round(sum(hold_days_list) / len(hold_days_list), 1) if hold_days_list else 0.0
    win_rate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0.0
    premium_capture_rate = round((total_cash_pnl / net_credit_opened * 100), 1) if net_credit_opened > 0 else 0.0

    monthly_list = []
    for m in sorted(monthly_stats.keys()):
        monthly_list.append({
            "month": m,
            "trades": monthly_stats[m]['trades'],
            "cash_pnl": round(monthly_stats[m]['cash_pnl'], 2),
            "broker_pnl": round(monthly_stats[m]['broker_pnl'], 2)
        })

    ticker_list = []
    for sym, st in ticker_stats.items():
        sym_hold = round(sum(st['hold_days']) / len(st['hold_days']), 1) if st['hold_days'] else 0.0
        decided = st['wins'] + st['losses']
        sym_win_rate = round(st['wins'] / decided * 100, 1) if decided > 0 else 0.0
        ticker_list.append({
            "symbol": sym,
            "trades": st['trades'],
            "wins": st['wins'],
            "losses": st['losses'],
            "win_rate": sym_win_rate,
            "cash_pnl": round(st['cash_pnl'], 2),
            "broker_pnl": round(st['broker_pnl'], 2),
            "avg_hold_days": sym_hold
        })
    ticker_list.sort(key=lambda x: x['cash_pnl'], reverse=True)

    return {
        "total_trades": len(groups),
        "total_legs": len(closed),
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "win_rate": win_rate,
        "cash_pnl": round(total_cash_pnl, 2),
        "broker_pnl": round(total_broker_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": profit_factor,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "avg_hold_days": avg_hold,
        "total_commissions": round(total_commissions, 2),
        "total_premium_harvested": round(total_premium, 2),
        "net_credit_opened": round(net_credit_opened, 2),
        "premium_capture_rate": premium_capture_rate,
        "outcomes": dict(outcomes_count),
        "monthly": monthly_list,
        "tickers": ticker_list
    }
