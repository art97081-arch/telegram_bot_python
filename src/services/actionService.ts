import { ActionRequest, ActionType, RequestStatus } from '../types';
import { RequestModel } from '../models/request';
import { LogService } from './logService';

export class ActionService {
  static async createRequest(
    userId: number,
    actionType: ActionType,
    data: any
  ): Promise<ActionRequest> {
    const request = await RequestModel.create({
      user_id: userId,
      action_type: actionType,
      data
    });

    await LogService.log({
      user_id: userId,
      action: 'create_request',
      details: { request_id: request.id, action_type: actionType }
    });

    return request;
  }

  static async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    result?: any,
    processedBy?: number
  ): Promise<ActionRequest | null> {
    const request = await RequestModel.updateStatus(requestId, status, result, processedBy);
    
    if (request) {
      await LogService.log({
        user_id: request.user_id,
        action: 'update_request_status',
        details: { 
          request_id: requestId, 
          status, 
          processed_by: processedBy 
        }
      });
    }

    return request;
  }

  static async getRequest(requestId: string): Promise<ActionRequest | null> {
    return await RequestModel.findById(requestId);
  }

  static async getUserRequests(userId: number): Promise<ActionRequest[]> {
    return await RequestModel.findByUserId(userId);
  }

  static async getPendingRequests(): Promise<ActionRequest[]> {
    return await RequestModel.findPending();
  }

  static async processRequest(requestId: string, processedBy: number): Promise<ActionRequest | null> {
    const request = await RequestModel.findById(requestId);
    if (!request) return null;

    if (request.status !== RequestStatus.PENDING) {
      throw new Error('Запрос уже обработан или в процессе обработки');
    }

    // Переводим в статус обработки
    const processingRequest = await this.updateRequestStatus(
      requestId, 
      RequestStatus.PROCESSING, 
      undefined, 
      processedBy
    );

    return processingRequest;
  }

  static async completeRequest(
    requestId: string, 
    result: any, 
    processedBy: number
  ): Promise<ActionRequest | null> {
    return await this.updateRequestStatus(
      requestId, 
      RequestStatus.COMPLETED, 
      result, 
      processedBy
    );
  }

  static async failRequest(
    requestId: string, 
    error: any, 
    processedBy: number
  ): Promise<ActionRequest | null> {
    return await this.updateRequestStatus(
      requestId, 
      RequestStatus.FAILED, 
      { error: error.message || error }, 
      processedBy
    );
  }

  static async cancelRequest(requestId: string, cancelledBy: number): Promise<ActionRequest | null> {
    return await this.updateRequestStatus(
      requestId, 
      RequestStatus.CANCELLED, 
      { cancelled_by: cancelledBy }, 
      cancelledBy
    );
  }

  static async getAllRequests(): Promise<ActionRequest[]> {
    return await RequestModel.getAllRequests();
  }

  static async getUserActions(userId: number, limit: number = 10): Promise<ActionRequest[]> {
    return await RequestModel.getUserRequests(userId, limit);
  }
}