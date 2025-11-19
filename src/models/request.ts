import { ActionRequest, ActionType, RequestStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RequestModel {
  private static requests: Map<string, ActionRequest> = new Map();

  static async create(data: {
    user_id: number;
    action_type: ActionType;
    data: any;
  }): Promise<ActionRequest> {
    const request: ActionRequest = {
      id: uuidv4(),
      user_id: data.user_id,
      action_type: data.action_type,
      status: RequestStatus.PENDING,
      data: data.data,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.requests.set(request.id, request);
    return request;
  }

  static async findById(id: string): Promise<ActionRequest | null> {
    return this.requests.get(id) || null;
  }

  static async updateStatus(
    id: string, 
    status: RequestStatus, 
    result?: any,
    processed_by?: number
  ): Promise<ActionRequest | null> {
    const request = this.requests.get(id);
    if (!request) return null;

    const updatedRequest = {
      ...request,
      status,
      result,
      processed_by,
      updated_at: new Date()
    };

    this.requests.set(id, updatedRequest);
    return updatedRequest;
  }

  static async findByUserId(userId: number): Promise<ActionRequest[]> {
    return Array.from(this.requests.values())
      .filter(req => req.user_id === userId);
  }

  static async findPending(): Promise<ActionRequest[]> {
    return Array.from(this.requests.values())
      .filter(req => req.status === RequestStatus.PENDING);
  }

  static async getAllRequests(): Promise<ActionRequest[]> {
    return Array.from(this.requests.values());
  }

  static async getUserRequests(userId: number, limit: number = 10): Promise<ActionRequest[]> {
    return Array.from(this.requests.values())
      .filter(req => req.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }
}